/**
 * Relative-date formatting for the history list and the home teaser.
 *
 * Pure and clock-free: it takes both the date to describe and `now`
 * explicitly, so callers pass `new Date()` (or a fixed `Date` in tests). It
 * never reads `new Date()` itself. The comparison is by *calendar
 * day* in the local timezone — "yesterday" means the prior calendar date,
 * not "24 hours ago" — so an expense logged five minutes after local midnight
 * still reads "today".
 */

/** Whole calendar days from `date` to `now`, by local-midnight day boundary. */
function calendarDaysAgo(date: Date, now: Date): number {
	const dateMidnight = Date.UTC(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);
	const nowMidnight = Date.UTC(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	const ms = nowMidnight - dateMidnight;
	return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * Describe `date` relative to `now` as "today" / "yesterday" / "N days ago".
 *
 * Boundaries are calendar days in the local timezone:
 *   - same calendar day → "today"
 *   - one calendar day earlier → "yesterday"
 *   - N (≥2) calendar days earlier → "N days ago"
 *
 * A date in the future (shouldn't happen for an append-only expense log, but
 * guarded anyway) is treated as "today".
 */
export function formatRelativeDate(date: Date, now: Date): string {
	const days = calendarDaysAgo(date, now);
	if (days <= 0) return "today";
	if (days === 1) return "yesterday";
	return `${days} days ago`;
}
