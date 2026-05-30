import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { prisma } from "#/db";
import { getCurrentCycle, getRecentCycles, STREAK_WINDOW_DAYS } from "#/domain";
import { EntryKind } from "#/generated/prisma/enums";
import { createTRPCRouter, protectedProcedure } from "./init";

/** Wire `kind` ("spend"|"adjustment") → Prisma `EntryKind`. */
function toPrismaKind(kind: "spend" | "adjustment"): EntryKind {
	return kind === "adjustment" ? EntryKind.ADJUSTMENT : EntryKind.SPEND;
}

/** Prisma `EntryKind` → wire `kind` ("spend"|"adjustment"). */
function toWireKind(kind: EntryKind): "spend" | "adjustment" {
	return kind === EntryKind.ADJUSTMENT ? "adjustment" : "spend";
}

/**
 * Budget procedures — scoped to the authenticated caller. The single
 * `Budget` row per user is keyed by userId, so a missing row means
 * "user hasn't onboarded yet".
 */
const budgetRouter = {
	get: protectedProcedure.query(async ({ ctx }) => {
		const row = await prisma.budget.findUnique({
			where: { userId: ctx.userId },
		});
		if (!row) return null;
		return {
			monthlyAmountCents: row.monthlyAmountCents,
			anchorDay: row.anchorDay,
			updatedAt: row.updatedAt,
		};
	}),

	set: protectedProcedure
		.input(
			z.object({
				monthlyAmountCents: z.number().int().nonnegative(),
				anchorDay: z.number().int().min(1).max(31),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const row = await prisma.budget.upsert({
				where: { userId: ctx.userId },
				create: {
					userId: ctx.userId,
					monthlyAmountCents: input.monthlyAmountCents,
					anchorDay: input.anchorDay,
				},
				update: {
					monthlyAmountCents: input.monthlyAmountCents,
					anchorDay: input.anchorDay,
				},
			});
			return {
				monthlyAmountCents: row.monthlyAmountCents,
				anchorDay: row.anchorDay,
				updatedAt: row.updatedAt,
			};
		}),
} satisfies TRPCRouterRecord;

/**
 * Expense procedures — scoped to the authenticated caller.
 *
 * The current cycle is a *local* notion (PRODUCT.md: the server never
 * computes "today"). So `listForCurrentCycle` takes the caller's local `now`
 * and reuses the pure domain `getCurrentCycle` to bound the query. The anchor
 * day comes from the user's budget; with no budget there is no cycle, so we
 * return an empty list.
 *
 * `update` edits the amount and note of an existing expense in place;
 * `createdAt` is never touched (no backdating), so an edited entry stays in
 * its original cycle. `delete` removes a single expense. Both are scoped to
 * the caller: the `where` filter pins both `id` and `userId`, so a request for
 * another user's row matches zero records (a no-op) rather than mutating it.
 */
const expenseRouter = {
	add: protectedProcedure
		.input(
			z
				.object({
					kind: z.enum(["spend", "adjustment"]).default("spend"),
					amountCents: z.number().int(),
					note: z.string().trim().max(280).optional(),
				})
				.superRefine((val, ctx) => {
					// A spend is money out: it must be strictly positive. An adjustment
					// carries a signed amount (top-up negative, set-aside positive) and
					// only has to be non-zero — a zero adjustment is meaningless.
					if (val.kind === "spend" && val.amountCents <= 0) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["amountCents"],
							message: "A spend amount must be positive.",
						});
					}
					if (val.kind === "adjustment" && val.amountCents === 0) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["amountCents"],
							message: "An adjustment amount must be non-zero.",
						});
					}
				}),
		)
		.mutation(async ({ ctx, input }) => {
			const row = await prisma.expense.create({
				data: {
					userId: ctx.userId,
					kind: toPrismaKind(input.kind),
					amountCents: input.amountCents,
					note: input.note && input.note.length > 0 ? input.note : null,
				},
			});
			return {
				id: row.id,
				kind: toWireKind(row.kind),
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			};
		}),

	listForCurrentCycle: protectedProcedure
		.input(z.object({ now: z.date() }))
		.query(async ({ ctx, input }) => {
			const budget = await prisma.budget.findUnique({
				where: { userId: ctx.userId },
			});
			if (!budget) return [];

			const cycle = getCurrentCycle(input.now, budget.anchorDay);
			const rows = await prisma.expense.findMany({
				where: {
					userId: ctx.userId,
					createdAt: { gte: cycle.start, lt: cycle.end },
				},
				orderBy: { createdAt: "desc" },
			});
			return rows.map((row) => ({
				id: row.id,
				kind: toWireKind(row.kind),
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			}));
		}),

	// Entries spanning the most recent `count` cycles, for the cross-cycle
	// monthly-trend chart. Like `listForCurrentCycle`, the cycle span is a *local*
	// notion: it takes the caller's local `now` and the user's anchor day, reuses
	// the pure domain `getRecentCycles` to enumerate the window, then bounds one
	// `findMany` to `[oldest cycle start, current cycle end)`. The client bins the
	// rows back into cycles via `cycleTotals` (the server never computes "today").
	// No budget → no cycles → an empty list.
	listForCycles: protectedProcedure
		.input(
			z.object({ now: z.date(), count: z.number().int().min(1).default(6) }),
		)
		.query(async ({ ctx, input }) => {
			const budget = await prisma.budget.findUnique({
				where: { userId: ctx.userId },
			});
			if (!budget) return [];

			// Newest → oldest. The span is the oldest cycle's start up to (but not
			// including) the current cycle's end — half-open, matching the cycles.
			const cycles = getRecentCycles(input.now, budget.anchorDay, input.count);
			const oldestStart = cycles[cycles.length - 1].start;
			const currentEnd = cycles[0].end;

			const rows = await prisma.expense.findMany({
				where: {
					userId: ctx.userId,
					createdAt: { gte: oldestStart, lt: currentEnd },
				},
				orderBy: { createdAt: "desc" },
			});
			return rows.map((row) => ({
				id: row.id,
				kind: toWireKind(row.kind),
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			}));
		}),

	// Raw entries for the streak engine's bounded lookback window, ending at the
	// caller's local `now`. The client bins these into local-midnight days and
	// computes the streaks (the server never computes "today"). The lower bound
	// is generous by a couple of days so a timezone offset between the server
	// `now` and the client's local day can't clip the window the client walks.
	listForStreak: protectedProcedure
		.input(z.object({ now: z.date() }))
		.query(async ({ ctx, input }) => {
			const budget = await prisma.budget.findUnique({
				where: { userId: ctx.userId },
			});
			if (!budget) return [];

			const windowStart = new Date(
				input.now.getFullYear(),
				input.now.getMonth(),
				input.now.getDate() - (STREAK_WINDOW_DAYS + 2),
			);
			const rows = await prisma.expense.findMany({
				where: {
					userId: ctx.userId,
					createdAt: { gte: windowStart },
				},
				orderBy: { createdAt: "desc" },
			});
			return rows.map((row) => ({
				id: row.id,
				kind: toWireKind(row.kind),
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			}));
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				// Signed: an adjustment's stored amount can be negative (a top-up), so
				// `update` accepts any non-zero integer. `kind` is immutable and so is
				// absent here — an entry never changes between spend and adjustment.
				amountCents: z
					.number()
					.int()
					.refine((n) => n !== 0, "Amount must be non-zero."),
				note: z.string().trim().max(280).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Edit amount + note in place, scoped to the caller via `id` + `userId`
			// (another user's row matches nothing, so it's a no-op). `createdAt` is
			// deliberately absent from `data` — an edit never re-dates an entry.
			await prisma.expense.updateMany({
				where: { id: input.id, userId: ctx.userId },
				data: {
					amountCents: input.amountCents,
					note: input.note && input.note.length > 0 ? input.note : null,
				},
			});
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Hard delete, scoped to the caller via `id` + `userId` (another
			// user's row matches nothing, so it's a no-op rather than an error).
			await prisma.expense.deleteMany({
				where: { id: input.id, userId: ctx.userId },
			});
		}),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
	budget: budgetRouter,
	expense: expenseRouter,
});
export type TRPCRouter = typeof trpcRouter;
