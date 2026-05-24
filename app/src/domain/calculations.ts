/**
 * Pure calculation functions — the load-bearing math of the entire product.
 *
 * Both formulas are re-evaluated on every render. They take a `now` so they
 * can be tested with a fake clock; they take expenses as a plain array so
 * they don't have to know where they came from.
 */

import { elapsedDaysInCycle, getCurrentCycle, totalDaysInCycle } from "./cycle";
import { Money } from "./money";
import type { Budget, Expense } from "./types";

/** Sum of expense amounts whose `createdAt` falls inside the given cycle. */
function sumExpensesInCycle(
	expenses: readonly Expense[],
	cycleStart: Date,
	cycleEnd: Date,
): Money {
	let sum = Money.zero();
	for (const e of expenses) {
		const t = e.createdAt.getTime();
		if (t >= cycleStart.getTime() && t < cycleEnd.getTime()) {
			sum = sum.add(e.amount);
		}
	}
	return sum;
}

/**
 * Daily available, scoped to the current cycle:
 *   (elapsed × monthly) / total − spent
 *
 * Negative results are allowed and *not* clamped — overspend is intentional
 * feedback (PRODUCT.md). Mid-cycle budget changes apply retroactively
 * because we re-read `budget.monthlyAmount` every call.
 */
export function calculateAvailableToday(
	budget: Budget,
	expenses: readonly Expense[],
	now: Date,
): Money {
	const cycle = getCurrentCycle(now, budget.anchorDay);
	const elapsed = elapsedDaysInCycle(cycle, now);
	const total = totalDaysInCycle(cycle);

	const earned = budget.monthlyAmount.scaleInt(elapsed).divideIntFloor(total);
	const spent = sumExpensesInCycle(expenses, cycle.start, cycle.end);
	return earned.subtract(spent);
}

/**
 * Monthly remaining: `monthly − sum(expenses in current cycle)`. Negatives
 * allowed; the UI styles them red ("−47 € over budget").
 */
export function calculateMonthlyRemaining(
	budget: Budget,
	expenses: readonly Expense[],
	now: Date,
): Money {
	const cycle = getCurrentCycle(now, budget.anchorDay);
	const spent = sumExpensesInCycle(expenses, cycle.start, cycle.end);
	return budget.monthlyAmount.subtract(spent);
}
