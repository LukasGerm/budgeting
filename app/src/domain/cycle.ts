/**
 * Cycle — a budget cycle bounded by two anchor dates.
 *
 * A cycle is the half-open interval `[start, end)` where `start` is the most
 * recent anchor at or before `now`, and `end` is the next anchor after
 * `start`. If the anchor day doesn't exist in a given month (e.g. anchor 31
 * in February), the cycle boundary falls on the last day of that month
 * (PRODUCT.md).
 *
 * Dates here are local-timezone calendar dates. The day boundary is local
 * midnight; the cycle's `start` and `end` are both 00:00:00 local. The
 * server never computes "today" — that's always derived from the caller's
 * `now` against their local timezone.
 */

export interface Cycle {
	readonly start: Date;
	readonly end: Date;
}

/**
 * Resolve the actual day-of-month for the given anchor in the given
 * year+month, clamping to the last day if the anchor doesn't exist.
 *
 * Example: `resolveAnchorDay(2024, 1, 31)` (month 1 = Feb, 0-indexed) -> 29 (leap year).
 */
function resolveAnchorDay(
	year: number,
	monthIndex: number,
	anchorDay: number,
): number {
	// Day 0 of next month = last day of `monthIndex`.
	const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
	return Math.min(anchorDay, daysInMonth);
}

/**
 * Build a local-midnight Date for the given (year, monthIndex, day).
 * Constructing via `new Date(y, m, d)` already yields local midnight, but
 * we wrap it so callers don't accidentally pass a UTC-flavoured number.
 */
function localMidnight(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

/**
 * Get the cycle currently containing `now` for the given anchor day.
 *
 * Boundary behaviour: when `now` is exactly at the anchor (same calendar
 * day, any time of day), the cycle starts at *this* anchor. The previous
 * cycle ended at the start of this anchor day. The interval is half-open:
 * `[start, end)`.
 */
export function getCurrentCycle(now: Date, anchorDay: number): Cycle {
	if (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
		throw new Error(`anchorDay must be integer 1–31, got ${anchorDay}`);
	}

	const year = now.getFullYear();
	const monthIndex = now.getMonth();
	const day = now.getDate();

	const thisMonthAnchor = resolveAnchorDay(year, monthIndex, anchorDay);

	let startYear: number;
	let startMonth: number;
	let startDay: number;

	if (day >= thisMonthAnchor) {
		// Cycle started in this month.
		startYear = year;
		startMonth = monthIndex;
		startDay = thisMonthAnchor;
	} else {
		// Cycle started in the previous month.
		const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
		const prevYear = monthIndex === 0 ? year - 1 : year;
		startYear = prevYear;
		startMonth = prevMonth;
		startDay = resolveAnchorDay(prevYear, prevMonth, anchorDay);
	}

	const start = localMidnight(startYear, startMonth, startDay);

	// End = next anchor after start.
	const nextMonth = startMonth === 11 ? 0 : startMonth + 1;
	const nextYear = startMonth === 11 ? startYear + 1 : startYear;
	const endDay = resolveAnchorDay(nextYear, nextMonth, anchorDay);
	const end = localMidnight(nextYear, nextMonth, endDay);

	return { start, end };
}

/**
 * Total whole days in the cycle (variable: 28–31). Computed against local
 * midnight boundaries so DST transitions don't add or subtract a day.
 */
export function totalDaysInCycle(cycle: Cycle): number {
	return daysBetween(cycle.start, cycle.end);
}

/**
 * How many full days have elapsed in the cycle as of `now`. On the anchor
 * day itself this is 1 (the day the cycle started is "day 1"). On the day
 * before the next anchor, this equals `totalDaysInCycle`.
 */
export function elapsedDaysInCycle(cycle: Cycle, now: Date): number {
	const startOfToday = localMidnight(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	// +1 because the start day itself counts as day 1.
	return daysBetween(cycle.start, startOfToday) + 1;
}

/**
 * Whole calendar days between two local-midnight dates. Robust against DST:
 * we read the day-difference via UTC arithmetic on the (year, month, day)
 * triples, sidestepping the 23/25-hour days that wall-clock subtraction
 * would otherwise produce.
 */
function daysBetween(a: Date, b: Date): number {
	const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
	const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
	const ms = bUtc - aUtc;
	return Math.round(ms / (24 * 60 * 60 * 1000));
}
