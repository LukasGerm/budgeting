import { describe, expect, it } from "vitest";
import {
	buildHeatmap,
	currentStreak,
	dayKey,
	HABIT_COLOR_PALETTE,
	pickHabitColor,
} from "./habit";

/** Construct a local Date at noon on the given y/m/d (month 1-indexed). */
function local(y: number, m: number, d: number): Date {
	return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Build a sorted array of dayKey strings from consecutive dates. */
function keys(start: Date, count: number): string[] {
	return Array.from({ length: count }, (_, i) => {
		const d = new Date(
			start.getFullYear(),
			start.getMonth(),
			start.getDate() + i,
		);
		return dayKey(d);
	});
}

// ---------------------------------------------------------------------------
// currentStreak
// ---------------------------------------------------------------------------

describe("currentStreak", () => {
	it("no completions → 0", () => {
		expect(currentStreak([], local(2025, 3, 20))).toBe(0);
	});

	it("a consecutive run ending today returns the correct count", () => {
		const today = local(2025, 3, 20);
		// Done Mar 18, 19, 20 → streak = 3
		const done = keys(local(2025, 3, 18), 3);
		expect(currentStreak(done, today)).toBe(3);
	});

	it("an unchecked today does NOT break a run built from prior days (provisional today)", () => {
		const today = local(2025, 3, 20);
		// Done Mar 18 and 19 only — today is missing.
		const done = keys(local(2025, 3, 18), 2);
		// Streak should still be 2 because today is provisional.
		expect(currentStreak(done, today)).toBe(2);
	});

	it("a missed past day resets streak to 0", () => {
		const today = local(2025, 3, 20);
		// Done Mar 18 and 20, but Mar 19 is missing.
		const done = [dayKey(local(2025, 3, 18)), dayKey(local(2025, 3, 20))];
		// Only today counts (Mar 19 gap breaks the run from before it).
		expect(currentStreak(done, today)).toBe(1);
	});

	it("a run longer than a typical heatmap window is fully counted", () => {
		const today = local(2025, 3, 20);
		// 120 consecutive days ending today — longer than any typical heatmap.
		// Start date: 2025-03-20 - 119 days = 2024-11-21.
		const done = keys(local(2024, 11, 21), 120);
		expect(currentStreak(done, today)).toBe(120);
	});

	it("a DST boundary (Europe spring-forward 2025-03-30) neither adds nor drops a day", () => {
		// Europe DST spring-forward: 2025-03-30 is 23 hours long.
		// Three consecutive local calendar days around the transition.
		const today = local(2025, 3, 31);
		const done = [
			dayKey(local(2025, 3, 29)),
			dayKey(local(2025, 3, 30)),
			dayKey(local(2025, 3, 31)),
		];
		expect(currentStreak(done, today)).toBe(3);
	});

	it("returns 0 when the only completion is today and today is not done (streak of 0 today, 0 past)", () => {
		// Sanity check: a run of zero is zero.
		expect(currentStreak([], local(2025, 3, 20))).toBe(0);
	});

	it("a single done day that is today counts as 1", () => {
		const today = local(2025, 3, 20);
		expect(currentStreak([dayKey(today)], today)).toBe(1);
	});

	it("completions in the future do not inflate the streak", () => {
		const today = local(2025, 3, 20);
		// Done today + some future keys (shouldn't happen in practice but must be
		// handled gracefully — future keys are simply further from today in the
		// backward walk and will never be reached).
		const done = [dayKey(today), dayKey(local(2025, 3, 21))];
		expect(currentStreak(done, today)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// buildHeatmap
// ---------------------------------------------------------------------------

describe("buildHeatmap", () => {
	it("returns exactly weekCount columns, each with 7 cells", () => {
		const today = local(2025, 3, 20); // Thursday
		const { weeks } = buildHeatmap([], today, 4);
		expect(weeks).toHaveLength(4);
		for (const col of weeks) {
			expect(col).toHaveLength(7);
		}
	});

	it("newest week is last (rightmost) and contains today", () => {
		const today = local(2025, 3, 20); // Thursday; getDay() === 4
		const { weeks } = buildHeatmap([], today, 4);
		const lastWeek = weeks[3];
		// Today should appear somewhere in the last column.
		const todayInLastWeek = lastWeek.some((cell) => cell.key === dayKey(today));
		expect(todayInLastWeek).toBe(true);
	});

	it("the first column contains the oldest visible Sunday and its week", () => {
		// 2025-03-20 is Thursday. Newest Sunday = 2025-03-16.
		// With 4 weeks: oldest Sunday = 2025-03-16 - 21 days = 2025-02-23.
		const today = local(2025, 3, 20);
		const { weeks } = buildHeatmap([], today, 4);
		const firstCell = weeks[0][0]; // first column, Sunday slot (index 0)
		// 2025-02-23 is a Sunday.
		expect(firstCell.date.getDay()).toBe(0); // Sunday
		expect(firstCell.date.getFullYear()).toBe(2025);
		expect(firstCell.date.getMonth()).toBe(1); // February (0-indexed)
		expect(firstCell.date.getDate()).toBe(23);
	});

	it("weekday ordering is Sunday-first (index 0 = Sunday)", () => {
		const today = local(2025, 3, 20); // Thursday
		const { weeks } = buildHeatmap([], today, 1);
		const col = weeks[0];
		for (let dow = 0; dow < 7; dow++) {
			expect(col[dow].date.getDay()).toBe(dow);
		}
	});

	it("cells after today are tagged 'future'", () => {
		// today = 2025-03-20 (Thursday, index 4 in its week column)
		const today = local(2025, 3, 20);
		const { weeks } = buildHeatmap([], today, 1);
		const col = weeks[0];
		// Friday (index 5) and Saturday (index 6) are after today.
		expect(col[5].state).toBe("future");
		expect(col[6].state).toBe("future");
	});

	it("today itself is tagged 'done' when it is in completionDays", () => {
		const today = local(2025, 3, 20);
		const { weeks } = buildHeatmap([dayKey(today)], today, 1);
		const col = weeks[0];
		const todayCell = col.find((c) => c.key === dayKey(today));
		expect(todayCell?.state).toBe("done");
	});

	it("today itself is tagged 'missed' when it is NOT in completionDays", () => {
		const today = local(2025, 3, 20);
		const { weeks } = buildHeatmap([], today, 1);
		const col = weeks[0];
		const todayCell = col.find((c) => c.key === dayKey(today));
		expect(todayCell?.state).toBe("missed");
	});

	it("past done days are tagged 'done'", () => {
		const today = local(2025, 3, 20);
		const yesterday = local(2025, 3, 19);
		const { weeks } = buildHeatmap([dayKey(yesterday)], today, 1);
		const col = weeks[0];
		const cell = col.find((c) => c.key === dayKey(yesterday));
		expect(cell?.state).toBe("done");
	});

	it("past days without a completion are tagged 'missed'", () => {
		const today = local(2025, 3, 20);
		const yesterday = local(2025, 3, 19);
		const { weeks } = buildHeatmap([], today, 1);
		const col = weeks[0];
		const cell = col.find((c) => c.key === dayKey(yesterday));
		expect(cell?.state).toBe("missed");
	});

	it("weekCount governs the number of week columns", () => {
		const today = local(2025, 3, 20);
		for (const n of [1, 4, 18, 26]) {
			expect(buildHeatmap([], today, n).weeks).toHaveLength(n);
		}
	});

	it("columns are in ascending date order (oldest first)", () => {
		const today = local(2025, 3, 20);
		const { weeks } = buildHeatmap([], today, 6);
		for (let i = 1; i < weeks.length; i++) {
			const prevSunday = weeks[i - 1][0].date.getTime();
			const curSunday = weeks[i][0].date.getTime();
			expect(curSunday).toBeGreaterThan(prevSunday);
		}
	});

	it("each cell carries the date that matches its key", () => {
		const today = local(2025, 3, 20);
		const { weeks } = buildHeatmap([], today, 3);
		for (const col of weeks) {
			for (const cell of col) {
				expect(cell.key).toBe(dayKey(cell.date));
			}
		}
	});

	it("tags future cells correctly when today is a single-digit date", () => {
		// today = 2025-03-09 (single-digit day). dayKey produces "2025-2-9".
		// Without the fix, "2025-2-9" > "2025-2-10" is false in JS string order,
		// so days 10–15 would be tagged 'missed' instead of 'future'.
		const today = local(2025, 3, 9); // Mar 9 — getDay() === 0 (Sunday)
		const { weeks } = buildHeatmap([], today, 3);
		const lastCol = weeks[weeks.length - 1];
		const futureCells = lastCol.filter(
			(c) => c.date.getTime() > today.getTime(),
		);
		expect(futureCells.length).toBeGreaterThan(0);
		for (const cell of futureCells) {
			expect(cell.state).toBe("future");
		}
	});

	it("handles a Sunday 'today' correctly (no future cells in last column)", () => {
		// 2025-03-16 is a Sunday.
		const today = local(2025, 3, 16);
		const { weeks } = buildHeatmap([], today, 2);
		const lastCol = weeks[1];
		// Sunday (index 0) = today; all others are future.
		expect(lastCol[0].state).toBe("missed"); // today, no completion
		for (let dow = 1; dow < 7; dow++) {
			expect(lastCol[dow].state).toBe("future");
		}
	});
});

// ---------------------------------------------------------------------------
// pickHabitColor
// ---------------------------------------------------------------------------

describe("pickHabitColor", () => {
	it("returns a palette color not in usedColors", () => {
		const color = pickHabitColor(HABIT_COLOR_PALETTE, []);
		expect(HABIT_COLOR_PALETTE).toContain(color);
	});

	it("avoids already-used colors when one is available", () => {
		// Use every color except the last.
		const allButLast = HABIT_COLOR_PALETTE.slice(0, -1);
		const color = pickHabitColor(HABIT_COLOR_PALETTE, [...allButLast]);
		expect(color).toBe(HABIT_COLOR_PALETTE[HABIT_COLOR_PALETTE.length - 1]);
	});

	it("falls back gracefully when the palette is exhausted", () => {
		const result = pickHabitColor(HABIT_COLOR_PALETTE, [
			...HABIT_COLOR_PALETTE,
		]);
		expect(HABIT_COLOR_PALETTE).toContain(result);
	});

	it("is deterministic (stable for the same inputs)", () => {
		const usedColors = [HABIT_COLOR_PALETTE[0], HABIT_COLOR_PALETTE[2]];
		const a = pickHabitColor(HABIT_COLOR_PALETTE, usedColors);
		const b = pickHabitColor(HABIT_COLOR_PALETTE, usedColors);
		expect(a).toBe(b);
	});

	it("returns the first unused palette entry (picks in order)", () => {
		// First palette color is used; should return the second.
		const used = [HABIT_COLOR_PALETTE[0]];
		expect(pickHabitColor(HABIT_COLOR_PALETTE, used)).toBe(
			HABIT_COLOR_PALETTE[1],
		);
	});

	it("when all colors used, fallback index is usedColors.length % palette.length", () => {
		// If usedColors.length === palette.length, index = 0 → first color.
		const allUsed = [...HABIT_COLOR_PALETTE];
		expect(pickHabitColor(HABIT_COLOR_PALETTE, allUsed)).toBe(
			HABIT_COLOR_PALETTE[allUsed.length % HABIT_COLOR_PALETTE.length],
		);
	});

	it("works correctly with a single-entry palette", () => {
		const singlePalette = ["#ff0000"];
		expect(pickHabitColor(singlePalette, [])).toBe("#ff0000");
		expect(pickHabitColor(singlePalette, ["#ff0000"])).toBe("#ff0000");
	});
});
