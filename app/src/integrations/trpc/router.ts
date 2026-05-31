import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { HABIT_ICON_NAMES } from "#/components/habits/habit-icons";
import { prisma } from "#/db";
import {
	getCurrentCycle,
	getRecentCycles,
	HABIT_COLOR_PALETTE,
	pickHabitColor,
	STREAK_WINDOW_DAYS,
} from "#/domain";
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

/**
 * Habit procedures — scoped to the authenticated caller.
 *
 * Wire contract for completion days:
 *   `HabitCompletion.day` is a `@db.Date` column; Prisma returns it as a
 *   UTC-midnight `Date`. We map it to an ISO calendar date string
 *   `"YYYY-MM-DD"` using UTC parts (toISOString().slice(0,10)) so the result
 *   is timezone-agnostic. Never apply local-parts `dayKey()` to a value from
 *   this column — in timezones west of UTC it would shift the day back by one.
 *
 *   The `use-habits` hook converts between this ISO wire format and the
 *   local-parts `dayKey` strings that the domain functions consume. Slices 4+
 *   do that conversion; in this slice completionDays flows through as-is.
 *
 * `list` takes no `now` input — it returns the full completion set so the
 * client can compute accurate streaks beyond any visible window, and because
 * "today" is a client concern (the server never computes it).
 */
const habitRouter = {
	/**
	 * Return all habits for the caller, ordered by createdAt ascending (stable
	 * creation order), each with its full completion day set as ISO strings.
	 *
	 * Completion days: `row.day.toISOString().slice(0, 10)` → `"YYYY-MM-DD"`.
	 * The client converts ISO → dayKey at the hook boundary (slice 4).
	 */
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = await prisma.habit.findMany({
			where: { userId: ctx.userId },
			orderBy: { createdAt: "asc" },
			include: { completions: true },
		});
		return rows.map((row) => ({
			id: row.id,
			name: row.name,
			icon: row.icon,
			color: row.color,
			createdAt: row.createdAt,
			completionDays: row.completions.map((c) =>
				c.day.toISOString().slice(0, 10),
			),
		}));
	}),

	/**
	 * Create a new habit for the caller. Color is auto-assigned server-side via
	 * `pickHabitColor` over the caller's existing habit colors, so the client
	 * never needs to supply or know about colors.
	 *
	 * Returns the created habit in the same wire shape as a `list` row (with an
	 * empty `completionDays`).
	 */
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().trim().min(1).max(60),
				icon: z.enum(HABIT_ICON_NAMES),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Fetch the caller's existing colors to pick a distinct one.
			const existing = await prisma.habit.findMany({
				where: { userId: ctx.userId },
				select: { color: true },
			});
			const usedColors = existing.map((h) => h.color);
			const color = pickHabitColor(HABIT_COLOR_PALETTE, usedColors);

			const row = await prisma.habit.create({
				data: {
					userId: ctx.userId,
					name: input.name,
					icon: input.icon,
					color,
				},
			});
			return {
				id: row.id,
				name: row.name,
				icon: row.icon,
				color: row.color,
				createdAt: row.createdAt,
				completionDays: [] as string[],
			};
		}),

	/**
	 * Rename / re-icon a caller-owned habit in place. Ownership is pinned in
	 * `where` (`id` + `userId`), so a request for another user's habit matches
	 * zero rows and is a no-op (no throw). `color` is deliberately absent from
	 * `data` — color is immutable post-create (mirrors the deliberate absence of
	 * `createdAt` in `expense.update`).
	 */
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().trim().min(1).max(60),
				icon: z.enum(HABIT_ICON_NAMES),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Edit name + icon in place, scoped to the caller via `id` + `userId`
			// (another user's habit matches nothing, so it's a no-op). `color` is
			// deliberately absent — a habit's color is immutable post-create.
			await prisma.habit.updateMany({
				where: { id: input.id, userId: ctx.userId },
				data: { name: input.name, icon: input.icon },
			});
		}),

	/**
	 * Hard-delete a caller-owned habit. Ownership is pinned in `where` (`id` +
	 * `userId`), so a request for another user's habit is a no-op (no throw).
	 * `HabitCompletion` rows cascade-delete via the `onDelete: Cascade` FK, so
	 * no manual completion cleanup is needed.
	 */
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Hard delete, scoped to the caller via `id` + `userId` (another
			// user's habit matches nothing, so it's a no-op rather than an error).
			// Completion rows cascade-delete automatically via the FK constraint.
			await prisma.habit.deleteMany({
				where: { id: input.id, userId: ctx.userId },
			});
		}),

	/**
	 * Toggle a completion for a given habit + local calendar day.
	 *
	 * Ownership gate (security boundary): the caller must own the habit. Because
	 * `HabitCompletion` has no `userId` column of its own, ownership is verified
	 * by looking up the parent habit row. A request for another user's `habitId`
	 * resolves `owned = null` and returns early — no write happens. This mirrors
	 * the expense `updateMany`/`deleteMany` ownership pattern, adapted for the
	 * case where the owned-id lives on the parent model.
	 *
	 * Idempotency:
	 *   - `done: true`  → upsert on the `@@unique([habitId, day])` constraint;
	 *     `update: {}` means a second tap is a no-op, not an error.
	 *   - `done: false` → `deleteMany` so a missing row is a no-op (not an error).
	 *
	 * Day handling: `day` arrives as an ISO calendar date `"YYYY-MM-DD"` (the
	 * client's local day). We parse it as UTC midnight (`T00:00:00.000Z`) so the
	 * stored `@db.Date` value round-trips byte-for-byte with the UTC-parts
	 * mapping in `list` (`c.day.toISOString().slice(0, 10)`). No local timezone
	 * math is applied on the server — the day is an opaque label the client owns.
	 */
	toggleCompletion: protectedProcedure
		.input(
			z.object({
				habitId: z.string(),
				/** ISO calendar date "YYYY-MM-DD" — the client's local day. */
				day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				done: z.boolean(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Ownership gate: verify the habit belongs to the caller before writing.
			const owned = await prisma.habit.findFirst({
				where: { id: input.habitId, userId: ctx.userId },
				select: { id: true },
			});
			if (!owned) {
				// Another user's habit (or non-existent) — return without writing.
				return;
			}

			// Parse the ISO day string as a UTC-midnight Date. Storing at UTC midnight
			// ensures `toISOString().slice(0, 10)` in `list` round-trips to the same
			// "YYYY-MM-DD" string the client supplied.
			const day = new Date(`${input.day}T00:00:00.000Z`);

			if (input.done) {
				// Upsert: idempotent against the @@unique([habitId, day]) constraint.
				// `update: {}` means a second tap on an already-done day is a no-op.
				await prisma.habitCompletion.upsert({
					where: { habitId_day: { habitId: input.habitId, day } },
					create: { habitId: input.habitId, day },
					update: {},
				});
			} else {
				// Delete: deleteMany so a missing row is a no-op, not a throw.
				await prisma.habitCompletion.deleteMany({
					where: { habitId: input.habitId, day },
				});
			}
		}),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
	budget: budgetRouter,
	expense: expenseRouter,
	habit: habitRouter,
});
export type TRPCRouter = typeof trpcRouter;
