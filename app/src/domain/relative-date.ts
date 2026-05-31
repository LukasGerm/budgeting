/**
 * Relative-date bucketing for the history list and the home teaser.
 *
 * Pure and clock-free: it takes both the date to describe and `now`
 * explicitly, so callers pass `new Date()` (or a fixed `Date` in tests). It
 * never reads `new Date()` itself. The comparison is by *calendar
 * day* in the local timezone — "yesterday" means the prior calendar date,
 * not "24 hours ago" — so an expense logged five minutes after local midnight
 * still reads "today".
 *
 * The public function returns a discriminated union (RelativeDate); the
 * consuming component assembles the final English copy from it.
 * Issue 04 will wrap that assembly in <Trans>/<plural> for translation.
 */

/** Whole calendar days from `date` to `now`, by local-midnight day boundary. */
export function calendarDaysAgo(date: Date, now: Date): number {
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

/** Structured relative-date bucket. The component renders the copy. */
export type RelativeDate =
	| { kind: "today" }
	| { kind: "yesterday" }
	| { kind: "days_ago"; days: number };

/**
 * Bucket `date` relative to `now` into a RelativeDate discriminated union.
 *
 * Boundaries are calendar days in the local timezone:
 *   - same calendar day → { kind: "today" }
 *   - one calendar day earlier → { kind: "yesterday" }
 *   - N (≥2) calendar days earlier → { kind: "days_ago", days: N }
 *
 * A date in the future (shouldn't happen for an append-only expense log, but
 * guarded anyway) is treated as "today".
 */
export function getRelativeDate(date: Date, now: Date): RelativeDate {
	const days = calendarDaysAgo(date, now);
	if (days <= 0) return { kind: "today" };
	if (days === 1) return { kind: "yesterday" };
	return { kind: "days_ago", days };
}
