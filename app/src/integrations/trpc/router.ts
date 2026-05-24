import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { prisma } from "#/db";
import { getCurrentCycle } from "#/domain";
import { createTRPCRouter, protectedProcedure } from "./init";

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
 * `delete` removes a single expense, but only one belonging to the caller.
 * The `where` filter pins both `id` and `userId`, so a request for another
 * user's row matches zero records (a no-op) rather than deleting it.
 */
const expenseRouter = {
	add: protectedProcedure
		.input(
			z.object({
				amountCents: z.number().int().positive(),
				note: z.string().trim().max(280).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const row = await prisma.expense.create({
				data: {
					userId: ctx.userId,
					amountCents: input.amountCents,
					note: input.note && input.note.length > 0 ? input.note : null,
				},
			});
			return {
				id: row.id,
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
				amountCents: row.amountCents,
				note: row.note,
				createdAt: row.createdAt,
			}));
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
