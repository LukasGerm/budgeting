/**
 * React hook for the Dashboard tab's derived figures.
 *
 * The Dashboard reuses Home's already-warmed data: `useBudget()` and
 * `useExpenses(now)` both read the SSR-prefetched current-cycle caches (no new
 * server procedure — the dashboard route prefetches the *same* queries Home
 * does). This hook only layers the pure domain derivations on top, so later
 * slices can extend it by adding more derived widgets here without touching the
 * data path.
 *
 * `now` must be the loader-provided cycle anchor (`startOfDay`), passed verbatim
 * to `useExpenses` so SSR and client key the query identically (see
 * `use-expenses.ts`). Returns `null` until a budget exists (no anchor → no
 * cycle, hence no summary).
 */

import type {
	CycleSpendSummary,
	DailySpendBuckets,
	EndOfCycleProjection,
	Expense,
	PacePoint,
} from "#/domain";
import {
	biggestSpends,
	cumulativePaceSeries,
	cycleSpendSummary,
	dailySpendBuckets,
	getCurrentCycle,
	projectEndOfCycle,
} from "#/domain";
import { useBudget } from "#/hooks/use-budget";
import { useExpenses } from "#/hooks/use-expenses";

/** How many of the largest current-cycle spends the dashboard lists. */
const BIGGEST_SPENDS_COUNT = 5;

export interface Dashboard {
	/** Headline figures for the current cycle (SPEND-only spend math). */
	readonly summary: CycleSpendSummary;
	/** Per-day cumulative net vs. ideal pace, up to `now` (cents). */
	readonly paceSeries: PacePoint[];
	/** Projected end-of-cycle net vs. budget (suppressed early in the cycle). */
	readonly projection: EndOfCycleProjection;
	/** Per-day SPEND-only bars for the full cycle, with the over/under threshold. */
	readonly dailySpend: DailySpendBuckets;
	/** The largest current-cycle spends, biggest first (up to {@link BIGGEST_SPENDS_COUNT}). */
	readonly biggest: Expense[];
}

export function useDashboard(now: Date): Dashboard | null {
	const budget = useBudget();
	const expenses = useExpenses(now);

	if (!budget) return null;

	const cycle = getCurrentCycle(now, budget.anchorDay);
	return {
		summary: cycleSpendSummary(cycle, expenses, now),
		paceSeries: cumulativePaceSeries(
			cycle,
			expenses,
			budget.monthlyAmount,
			now,
		),
		projection: projectEndOfCycle(budget, expenses, now),
		dailySpend: dailySpendBuckets(cycle, expenses, budget.monthlyAmount),
		biggest: biggestSpends(expenses, BIGGEST_SPENDS_COUNT),
	};
}
