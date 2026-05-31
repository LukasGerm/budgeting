/**
 * Habit domain module — pure, clock-free, no DB import.
 *
 * All functions accept "today" as a caller-supplied `Date` so this module can
 * be exhaustively unit-tested without mocking the clock. This mirrors the
 * design of `streak.ts`.
 *
 * Day-identity convention:
 *   A local calendar day is represented as the string produced by `dayKey(d)`:
 *   `"<year>-<month0>-<date>"` using *local* parts (getFullYear/getMonth/getDate),
 *   exactly matching the `dayKey` function in `streak.ts`. This means:
 *   - Two `Date` objects that fall on the same local calendar day hash to the
 *     same key regardless of their time component.
 *   - The client supplies this key when calling `toggleCompletion`. When
 *     round-tripping through a `@db.Date` column, carry the day as this string,
 *     not as a reconstructed `Date`. Prisma returns `@db.Date` as a UTC-midnight
 *     `Date`, so calling `dayKey` on it will shift the day back by one in any
 *     timezone west of UTC. If a key must be derived from a `@db.Date` value,
 *     derive it from the value's UTC parts (getUTCFullYear / getUTCMonth /
 *     getUTCDate) rather than its local parts.
 *   - DST transitions are safe because we rely on local *parts*, not arithmetic
 *     on millisecond differences.
 */

/** A stable key for a local calendar day (local Y-M-D parts, zero-indexed month). */
export function dayKey(d: Date): string {
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

/**
 * Curated dark-theme habit color palette. Values are hex strings chosen for
 * good contrast against the app's dark background (zinc-950 / zinc-900).
 * Ten entries keeps the palette varied while staying manageable.
 */
export const HABIT_COLOR_PALETTE: readonly string[] = [
	"#f87171", // red-400
	"#fb923c", // orange-400
	"#facc15", // yellow-400
	"#4ade80", // green-400
	"#34d399", // emerald-400
	"#22d3ee", // cyan-400
	"#818cf8", // indigo-400
	"#e879f9", // fuchsia-400
	"#f472b6", // pink-400
	"#a78bfa", // violet-400
];

// ---------------------------------------------------------------------------
// currentStreak
// ---------------------------------------------------------------------------

/**
 * Compute the current consecutive-done streak ending today for a single habit.
 *
 * `completionDays` is the full set of `dayKey` strings for which the habit has
 * been marked done. Because the full set is provided, this is accurate for
 * streaks longer than any visible heatmap window.
 *
 * **Provisional today:** an unchecked today does NOT break a streak built from
 * prior consecutive days — it is simply not yet counted. A *past* gap (a day
 * prior to today that is absent from `completionDays`) stops the walk. This
 * mirrors the `currentRun` semantics in `streak.ts`.
 *
 * Days are stepped via calendar arithmetic (DST-safe): `new Date(y, m, d - i)`
 * constructs the local date for each step.
 */
export function currentStreak(
	completionDays: readonly string[],
	today: Date,
): number {
	const done = new Set(completionDays);
	// Start from today and walk backwards.
	const y = today.getFullYear();
	const m = today.getMonth();
	const d = today.getDate();

	let count = 0;
	let i = 0;
	while (true) {
		const day = new Date(y, m, d - i);
		const key = dayKey(day);
		if (done.has(key)) {
			count++;
		} else if (i === 0) {
			// Today is provisional: skip without breaking.
		} else {
			// Past gap — stop.
			break;
		}
		i++;
		// Safety: stop after a year of walking back to avoid an infinite loop on
		// pathological inputs. Real data won't come close.
		if (i > 366) break;
	}
	return count;
}

// ---------------------------------------------------------------------------
// buildHeatmap
// ---------------------------------------------------------------------------

/** The three states a heatmap cell can be in. */
export type HeatmapCellState = "done" | "missed" | "future";

/** A single cell in the contribution heatmap. */
export interface HeatmapCell {
	/** Stable day-identity key (dayKey format). Use this for toggling / lookup. */
	readonly key: string;
	/** The local Date for this cell — use for display/labelling. */
	readonly date: Date;
	/** Completion state relative to "today". */
	readonly state: HeatmapCellState;
}

/**
 * Build the week-column × weekday-row heatmap grid for one habit.
 *
 * Layout decisions:
 * - **Weekday ordering:** Sunday-first (index 0 = Sunday, 6 = Saturday),
 *   matching GitHub's contribution graph. Each inner array (a "week column")
 *   has exactly 7 cells, one per weekday, Sunday at index 0.
 * - **Column ordering:** oldest week first, newest week LAST (rightmost). This
 *   matches the GitHub graph convention: time flows left → right.
 * - **Window:** `weekCount` full weeks ending with the week that contains
 *   `today`. The oldest visible week therefore starts on the Sunday on or
 *   before `(today − (weekCount − 1) * 7)`.
 * - **Edge cells:** cells in the oldest/newest column that fall *after today*
 *   within that week are tagged `"future"`. Cells in the oldest visible week
 *   that fall *before* the window's Sunday anchor are never produced (the
 *   window always starts cleanly on a Sunday).
 * - **Cell state:** `done` if the day is in `completionDays`, `future` if the
 *   day is after today, `missed` otherwise.
 *
 * @param completionDays - Full set of `dayKey` strings for completed days.
 * @param today          - The caller's local "now" Date.
 * @param weekCount      - Number of week columns to return (e.g. 18 ≈ 4 months).
 */
export function buildHeatmap(
	completionDays: readonly string[],
	today: Date,
	weekCount: number,
): { weeks: HeatmapCell[][] } {
	const done = new Set(completionDays);
	// Local midnight for today — used for date-order comparison (not string).
	const todayStart = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
	).getTime();

	// Find the Sunday that starts the newest (rightmost) week column.
	// today.getDay() returns 0 (Sun) – 6 (Sat).
	const todayDow = today.getDay(); // 0 = Sun
	const newestSundayDate = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate() - todayDow,
	);

	// The oldest Sunday is (weekCount - 1) weeks before the newest Sunday.
	const oldestSundayDate = new Date(
		newestSundayDate.getFullYear(),
		newestSundayDate.getMonth(),
		newestSundayDate.getDate() - (weekCount - 1) * 7,
	);

	const weeks: HeatmapCell[][] = [];

	for (let w = 0; w < weekCount; w++) {
		// Sunday of this week column.
		const weekSunday = new Date(
			oldestSundayDate.getFullYear(),
			oldestSundayDate.getMonth(),
			oldestSundayDate.getDate() + w * 7,
		);

		const column: HeatmapCell[] = [];
		for (let dow = 0; dow < 7; dow++) {
			const cellDate = new Date(
				weekSunday.getFullYear(),
				weekSunday.getMonth(),
				weekSunday.getDate() + dow,
			);
			const key = dayKey(cellDate);

			let state: HeatmapCellState;
			// Compare by date (local midnight ms) to avoid non-zero-padded key
			// string ordering issues (e.g. "2025-2-9" > "2025-2-10" is false).
			if (cellDate.getTime() > todayStart) {
				state = "future";
			} else if (done.has(key)) {
				state = "done";
			} else {
				state = "missed";
			}

			column.push({ key, date: cellDate, state });
		}
		weeks.push(column);
	}

	return { weeks };
}

// ---------------------------------------------------------------------------
// pickHabitColor
// ---------------------------------------------------------------------------

/**
 * Choose a color for a new habit.
 *
 * Strategy:
 * 1. Return the first palette entry not already in `usedColors`.
 * 2. If the entire palette is in use, fall back deterministically:
 *    return `palette[usedColors.length % palette.length]`.
 *    This is stable for the same `usedColors` length and always returns a
 *    palette entry.
 *
 * @param palette    - The ordered color palette to pick from.
 * @param usedColors - Colors already assigned to the caller's existing habits.
 */
export function pickHabitColor(
	palette: readonly string[],
	usedColors: readonly string[],
): string {
	const used = new Set(usedColors);
	for (const color of palette) {
		if (!used.has(color)) return color;
	}
	// All palette entries are taken — wrap deterministically.
	return palette[usedColors.length % palette.length];
}
