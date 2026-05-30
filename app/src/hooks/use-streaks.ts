/**
 * React hook for the restraint streaks shown in the home header.
 *
 * Reads the bounded streak window through the `useTRPC()` options proxy (so the
 * SSR-prefetched cache entry is hit and the key matches the home loader), maps
 * the wire rows to domain `Expense`es, then computes the streaks **on the
 * client** via the pure `computeStreaks` engine — the day boundary is local
 * midnight and the server never computes "today" (so the binning must happen in
 * the device's timezone).
 *
 * `now` must be the loader-provided cycle anchor (`startOfDay`), used verbatim
 * as the query input and as the engine's "today" so SSR and client agree.
 * Returns `null` until a budget exists (no rate → no streak).
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import {
	computeStreaks,
	Money,
	STREAK_WINDOW_DAYS,
	type StreakResult,
} from "#/domain";
import { useBudget } from "#/hooks/use-budget";
import { useTRPC } from "#/integrations/trpc/react";

export function useStreaks(now: Date): StreakResult | null {
	const trpc = useTRPC();
	const budget = useBudget();
	const { data: entries } = useSuspenseQuery(
		trpc.expense.listForStreak.queryOptions(
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

	if (!budget) return null;
	return computeStreaks(entries, budget, now, STREAK_WINDOW_DAYS);
}
