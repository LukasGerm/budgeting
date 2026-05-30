/**
 * React hook for the Dashboard's cross-cycle monthly-trend data.
 *
 * Unlike `useDashboard` (which reads the *current-cycle* list Home already
 * warms), the trend needs entries spanning the last several cycles — a
 * different server read, `expense.listForCycles`. This hook owns that query,
 * maps wire cents → domain `Expense` (via `Money.fromCents`, like
 * `use-expenses`), enumerates the cycle window with `getRecentCycles`, and bins
 * the entries into per-cycle net totals with `cycleTotals`.
 *
 * `now` must be the loader-provided cycle anchor (`startOfDay`), passed verbatim
 * so SSR and client key the query identically — same rule as `useExpenses` (see
 * its file header for why re-deriving it client-side breaks the cache key). The
 * dashboard route prefetches `expense.listForCycles.queryOptions({ now })`, so
 * the suspense query resolves from the SSR cache on first paint.
 *
 * Returns `null` until a budget exists (no anchor → no cycle window). When a
 * budget exists, returns the per-cycle totals (newest → oldest, as
 * `getRecentCycles` yields) plus the monthly budget amount for the chart's
 * reference line, and the vs.-last-cycle comparison (`compareToLastCycle`) — both
 * derived from the same `cycles` + multi-cycle `expenses`. `comparison` is `null`
 * when there is no previous cycle to compare against.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import type { CycleComparison, CycleTotal, Money as MoneyType } from "#/domain";
import {
	compareToLastCycle,
	cycleTotals,
	getRecentCycles,
	Money,
} from "#/domain";
import { useBudget } from "#/hooks/use-budget";
import { useTRPC } from "#/integrations/trpc/react";

/** How many cycles the monthly trend looks back over. */
export const TREND_CYCLE_COUNT = 6;

export interface CycleTotalsResult {
	/** Per-cycle net totals, newest → oldest (chart reverses for display). */
	readonly totals: CycleTotal[];
	/** The monthly budget, for the chart's reference line. */
	readonly monthlyAmount: MoneyType;
	/**
	 * This cycle's net spend "so far" vs the same elapsed point in the previous
	 * cycle. `null` when there is no previous cycle (single-cycle window).
	 */
	readonly comparison: CycleComparison | null;
}

export function useCycleTotals(now: Date): CycleTotalsResult | null {
	const trpc = useTRPC();
	const budget = useBudget();
	const { data: expenses } = useSuspenseQuery(
		trpc.expense.listForCycles.queryOptions(
			{ now, count: TREND_CYCLE_COUNT },
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

	if (!budget) return null;

	const cycles = getRecentCycles(now, budget.anchorDay, TREND_CYCLE_COUNT);
	return {
		totals: cycleTotals(cycles, expenses),
		monthlyAmount: budget.monthlyAmount,
		comparison: compareToLastCycle(cycles, expenses, now),
	};
}
