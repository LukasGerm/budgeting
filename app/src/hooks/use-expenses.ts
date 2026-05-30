/**
 * React hooks for the current cycle's expenses (spends *and* adjustments).
 *
 * Reads go through the `useTRPC()` options proxy (so the SSR-prefetched cache
 * entry is hit and the query key matches the route loader); writes call the
 * vanilla tRPC client directly so we can map wire cents → domain `Expense`
 * (a `Money` amount) at this hook boundary. Components only ever see domain
 * shapes; the wire only ever sees cents.
 *
 * The current cycle is anchored to a `now` that the **route loader** computes
 * once (`startOfDay(new Date())`) and passes to the component. `useExpenses`
 * uses that value *verbatim* as the query input — it must NOT re-apply
 * `startOfDay`, because `startOfDay` reads local date parts: re-deriving it on
 * the client (browser TZ) from the loader's value (server TZ) yields a
 * different instant → a different query key than the SSR prefetch → the client
 * misses the hydrated entry, refetches, and the SSR/client renders disagree
 * (React hydration error #418 + a stale list). The loader is the single source
 * of `now` so server and client key the query identically.
 *
 * Adds, edits and deletes invalidate the list so the home daily/monthly
 * numbers recompute from the new total.
 */

import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { EntryKind, Expense } from "#/domain";
import { Money } from "#/domain";
import { trpcClient } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

export interface NewExpense {
	/** Signed for an adjustment (see `entry.ts`); positive for a spend. */
	amountCents: number;
	note?: string;
	/** Defaults to a spend on the server when omitted. */
	kind?: EntryKind;
}

/**
 * Local midnight of `now`. Call this **only in the route loader** to derive the
 * cycle anchor once; pass the result through to `useExpenses`. Do not call it in
 * a component — see the file header (re-deriving it client-side breaks the key).
 */
export function startOfDay(now: Date): Date {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * The current cycle's entries, mapped from wire cents to domain `Expense`.
 *
 * `now` must be the loader-provided cycle anchor; it is used verbatim as the
 * query input so the SSR prefetch and client hydration share one key.
 */
export function useExpenses(now: Date): Expense[] {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(
		trpc.expense.listForCurrentCycle.queryOptions(
			{ now },
			{
				select: (rows) =>
					rows.map((row) => ({
						id: row.id,
						kind: row.kind,
						amount: Money.fromCents(row.amountCents),
						note: row.note,
						createdAt: row.createdAt,
					})),
			},
		),
	);
	return data;
}

/** Mutation: append an entry (spend or adjustment), then refresh the list. */
export function useAddExpense() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.expense.add.mutationKey(),
		mutationFn: async (expense: NewExpense): Promise<Expense> => {
			const row = await trpcClient.expense.add.mutate({
				kind: expense.kind,
				amountCents: expense.amountCents,
				note: expense.note,
			});
			return {
				id: row.id,
				kind: row.kind,
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

/**
 * Mutation: edit an existing entry's amount and note, then refresh the cycle
 * list. The wire takes integer cents directly (signed for an adjustment); no
 * `Money` mapping is needed here and `createdAt` is never sent.
 */
export function useUpdateExpense() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation(
		trpc.expense.update.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries(
					trpc.expense.listForCurrentCycle.queryFilter(),
				),
		}),
	);
}

/** Mutation: delete an entry by id, then refresh the cycle list. */
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
