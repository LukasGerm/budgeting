/**
 * Monthly-line structured data for the home screen.
 *
 * Pure and presentation-shaped: given the cycle's remaining balance, the total
 * budget, and the cycle position, it returns a discriminated union describing
 * the status. The consuming component assembles the final string from this data
 * (with money/dates locale-formatted via `useFormat`).
 *
 *   - non-negative remaining → { kind: "on_track", ... }
 *   - negative remaining      → { kind: "over_budget", ... }
 *
 * The sign carries the message — no shaming copy, no icons
 * (PRODUCT.md: "punish me, don't yell at me").
 *
 * Issue 04 will wrap the sentence assembly in <Trans>/<plural> for translation.
 */

import type { Money } from "./money";

export type MonthlyStatus =
	| { kind: "over_budget"; remainingCents: number }
	| {
			kind: "on_track";
			remainingCents: number;
			budgetCents: number;
			elapsedDays: number;
			totalDays: number;
	  };

export function getMonthlyStatus(
	monthlyRemaining: Money,
	monthlyBudget: Money,
	elapsedDays: number,
	totalDays: number,
): MonthlyStatus {
	if (monthlyRemaining.isNegative()) {
		return { kind: "over_budget", remainingCents: monthlyRemaining.toCents() };
	}
	return {
		kind: "on_track",
		remainingCents: monthlyRemaining.toCents(),
		budgetCents: monthlyBudget.toCents(),
		elapsedDays,
		totalDays,
	};
}
