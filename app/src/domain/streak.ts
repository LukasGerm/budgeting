/**
 * Streak engine — the restraint-streak logic, pure and clock-free.
 *
 * Given the ledger entries in a bounded lookback window, the budget (for the
 * daily rate) and a `now` instant, it returns two nested streaks:
 *
 *   { underRate: { current, best }, noSpend: { current, best } }
 *
 * - **under-rate** day: the day's total *spend* is at or below that day's daily
 *   rate (`monthly ÷ days in the cycle that day belongs to`). Normal small
 *   spending keeps it alive; only a blowout breaks it.
 * - **no-spend** day: the day's total spend is exactly zero. Stricter, and by
 *   construction a subset of under-rate days.
 *
 * Design notes:
 * - **Spends only.** Adjustments (top-ups / set-asides) are excluded from the
 *   per-day total (via `kind`), so walling off money or logging a refund never
 *   breaks or extends a streak. An adjustment also never *establishes* a streak:
 *   with no spends at all the result is 0/0.
 * - **Local-midnight days.** Entries are binned by their local calendar day and
 *   days are stepped via calendar arithmetic, so a DST transition neither adds
 *   nor drops a day. This is why the computation runs client-side (the device's
 *   local timezone), consistent with the rule that the server never computes
 *   "today".
 * - **Per-day rate.** Each day is judged against *its own* cycle's daily rate,
 *   so cross-cycle streaks compare correctly even when cycles differ in length.
 * - **Provisional today.** Today counts the moment it is within rate and drops
 *   off (without breaking the streak) if it goes over during the day; it locks
 *   in once it becomes a past day. A *past* losing day stops the current streak.
 * - **Bounded.** Only the last `windowDays` days are considered and the streak
 *   never predates the first-ever spend, so a brand-new user reads 0, not the
 *   whole window. A streak that fills the window is reported as the window
 *   length; the UI displays that capped (e.g. "90+").
 */

import { getCurrentCycle, totalDaysInCycle } from "./cycle";
import type { Budget, Expense } from "./types";

/** Default lookback window (days). Also the value the streak is capped at. */
export const STREAK_WINDOW_DAYS = 90;

export interface StreakPair {
	/** The current run ending today (today provisional). */
	readonly current: number;
	/** The longest run anywhere in the window. */
	readonly best: number;
}

export interface StreakResult {
	readonly underRate: StreakPair;
	readonly noSpend: StreakPair;
}

/** A stable key for an entry's local calendar day (DST-safe: local parts). */
function dayKey(d: Date): string {
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const ZERO: StreakResult = {
	underRate: { current: 0, best: 0 },
	noSpend: { current: 0, best: 0 },
};

/**
 * Compute the under-rate and no-spend streaks from the entries in the window.
 *
 * `entries` need not be sorted or pre-filtered; only spends within the window
 * affect the result. `now` is the caller's local instant ("today"); the day it
 * falls on is treated provisionally.
 */
export function computeStreaks(
	entries: readonly Expense[],
	budget: Budget,
	now: Date,
	windowDays: number = STREAK_WINDOW_DAYS,
): StreakResult {
	// Sum spends-only per local day, and remember the earliest spend day: the
	// streak can't predate the user's first spend.
	const spentByDay = new Map<string, number>();
	let earliestSpendMs = Number.POSITIVE_INFINITY;
	for (const e of entries) {
		if (e.kind !== "spend") continue;
		const c = e.createdAt;
		spentByDay.set(
			dayKey(c),
			(spentByDay.get(dayKey(c)) ?? 0) + e.amount.toCents(),
		);
		const dayStartMs = new Date(
			c.getFullYear(),
			c.getMonth(),
			c.getDate(),
		).getTime();
		if (dayStartMs < earliestSpendMs) earliestSpendMs = dayStartMs;
	}

	// No spends at all → no streak (adjustments alone never create one).
	if (!Number.isFinite(earliestSpendMs)) return ZERO;

	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	// Walk back from today, newest first, until the window edge or the first
	// spend day. Each day carries its two win flags.
	const days: { underWin: boolean; noSpendWin: boolean }[] = [];
	for (let i = 0; i < windowDays; i++) {
		const d = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate() - i,
		);
		if (d.getTime() < earliestSpendMs) break;
		const spent = spentByDay.get(dayKey(d)) ?? 0;
		const cycle = getCurrentCycle(d, budget.anchorDay);
		const rate = budget.monthlyAmount
			.divideIntFloor(totalDaysInCycle(cycle))
			.toCents();
		days.push({ underWin: spent <= rate, noSpendWin: spent === 0 });
	}

	return {
		underRate: {
			current: currentRun(days, (day) => day.underWin),
			best: bestRun(days, (day) => day.underWin),
		},
		noSpend: {
			current: currentRun(days, (day) => day.noSpendWin),
			best: bestRun(days, (day) => day.noSpendWin),
		},
	};
}

type Day = { underWin: boolean; noSpendWin: boolean };

/**
 * The current run ending today. `days[0]` is today and is provisional: a
 * non-winning today doesn't *break* the streak, it just doesn't count yet. A
 * non-winning *past* day stops the walk.
 */
function currentRun(days: readonly Day[], isWin: (d: Day) => boolean): number {
	let count = 0;
	for (let i = 0; i < days.length; i++) {
		if (isWin(days[i])) count++;
		else if (i === 0) continue;
		else break;
	}
	return count;
}

/** The longest run of consecutive winning days anywhere in the window. */
function bestRun(days: readonly Day[], isWin: (d: Day) => boolean): number {
	let best = 0;
	let run = 0;
	for (const day of days) {
		if (isWin(day)) {
			run++;
			if (run > best) best = run;
		} else {
			run = 0;
		}
	}
	return best;
}
