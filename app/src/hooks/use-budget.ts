/**
 * React hooks for the user's Budget.
 *
 * Data comes straight from tRPC via TanStack Query. Reads go through the
 * `useTRPC()` options proxy (so the SSR-prefetched cache entry is hit and the
 * query key matches the route loader); the write calls the vanilla tRPC client
 * directly so we can map domain `Budget` (a `Money` amount) → integer cents at
 * this hook boundary. Components only ever see domain shapes; the wire only
 * ever sees cents. Routes prefetch `budget.get` in their loader, so the
 * suspense query resolves from cache on first paint (SSR) with no loading flash.
 */

import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { Budget } from "#/domain";
import { Money } from "#/domain";
import { trpcClient } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

/** The current user's budget, mapped from wire cents to a domain `Budget`. */
export function useBudget(): Budget | null {
	const trpc = useTRPC();
	const { data } = useSuspenseQuery(
		trpc.budget.get.queryOptions(undefined, {
			select: (row) =>
				row
					? {
							monthlyAmount: Money.fromCents(row.monthlyAmountCents),
							anchorDay: row.anchorDay,
						}
					: null,
		}),
	);
	return data;
}

/**
 * Mutation: write the budget, then refresh the budget query.
 *
 * Takes a domain `Budget` and maps `Money` → integer cents at this boundary so
 * callers stay in domain types; the wire only ever sees cents.
 */
export function useSetBudget() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: trpc.budget.set.mutationKey(),
		mutationFn: (budget: Budget) =>
			trpcClient.budget.set.mutate({
				monthlyAmountCents: budget.monthlyAmount.toCents(),
				anchorDay: budget.anchorDay,
			}),
		onSuccess: () =>
			queryClient.invalidateQueries(trpc.budget.get.queryFilter()),
	});
}
