/**
 * Monthly-line copy for the home screen.
 *
 * Pure and presentation-shaped: given the cycle's remaining balance, the total
 * budget, and the cycle position, it returns the single secondary line under
 * the daily number. The sign carries the message — no shaming copy, no icons
 * (PRODUCT.md: "punish me, don't yell at me").
 *
 *   - non-negative remaining → "X € left of Y € · day N of M"
 *   - negative remaining      → "-X € over budget" (the negative is the signal)
 *
 * Money already formats negatives with a leading minus ("-47,00 €"), so the
 * over-budget string reuses `format()` verbatim rather than re-deriving a sign.
 */

import type { Money } from "./money";

export function formatMonthlyStatus(
	monthlyRemaining: Money,
	monthlyBudget: Money,
	elapsedDays: number,
	totalDays: number,
): string {
	if (monthlyRemaining.isNegative()) {
		return `${monthlyRemaining.format()} over budget`;
	}
	return `${monthlyRemaining.format()} left of ${monthlyBudget.format()} · day ${elapsedDays} of ${totalDays}`;
}
