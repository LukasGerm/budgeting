/**
 * React hooks for the current cycle's expenses.
 *
 * Reads go through the `useTRPC()` options proxy (so the SSR-prefetched cache
 * entry is hit and the query key matches the route loader); writes call the
 * vanilla tRPC client directly so we can map wire cents → domain `Expense`
 * (a `Money` amount) at this hook boundary. Components only ever see domain
 * shapes; the wire only ever sees cents.
 *
 * The current cycle is a *local* notion, so the query input carries a `now` —
 * but we key it on the **start of the local day** (`startOfDay`) so the cache
 * key is stable across renders and the server prefetch and client hydration
 * agree on the same key (a raw `Date` would differ every render and thrash the
 * cache / miss the SSR-prefetched entry). A new calendar day naturally produces
 * a new key, shifting the list to the new cycle.
 *
 * Adds and deletes invalidate the list so the home daily/monthly numbers
 * recompute from the new total.
 */

import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { Expense } from "#/domain";
import { Money } from "#/domain";
import { trpcClient } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

export interface NewExpense {
	amountCents: number;
	note?: string;
}

/** Local midnight of `now`, used as the stable query input for the cycle. */
export function startOfDay(now: Date): Date {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** The current cycle's expenses, mapped from wire cents to domain `Expense`. */
export function useExpenses(now: Date): Expense[] {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(
		trpc.expense.listForCurrentCycle.queryOptions(
			{ now: startOfDay(now) },
			{
				select: (rows) =>
					rows.map((row) => ({
						id: row.id,
						amount: Money.fromCents(row.amountCents),
						note: row.note,
						createdAt: row.createdAt,
					})),
			},
		),
	);
	return data;
}

/** Mutation: append an expense, then refresh the cycle list. */
export function useAddExpense() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.expense.add.mutationKey(),
		mutationFn: async (expense: NewExpense): Promise<Expense> => {
			const row = await trpcClient.expense.add.mutate({
				amountCents: expense.amountCents,
				note: expense.note,
			});
			return {
				id: row.id,
				amount: Money.fromCents(row.amountCents),
				note: row.note,
				createdAt: row.createdAt,
			};
		},
		onSuccess: () =>
			queryClient.invalidateQueries(
				trpc.expense.listForCurrentCycle.queryFilter(),
			),
	});
}

/** Mutation: delete an expense by id, then refresh the cycle list. */
export function useDeleteExpense() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation(
		trpc.expense.delete.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries(
					trpc.expense.listForCurrentCycle.queryFilter(),
				),
		}),
	);
}
