import { describe, expect, it } from "vitest";
import { elapsedDaysInCycle, getCurrentCycle, totalDaysInCycle } from "./cycle";

/** Helper: a local-time Date built from y/m/d (month is 1-indexed for tests). */
function local(y: number, m: number, d: number, hh = 12, mm = 0): Date {
	return new Date(y, m - 1, d, hh, mm, 0, 0);
}

describe("getCurrentCycle", () => {
	it("returns a cycle starting on the current month's anchor when now > anchor", () => {
		// Anchor 15, today is the 20th → cycle is [Mar 15, Apr 15).
		const cycle = getCurrentCycle(local(2025, 3, 20), 15);
		expect(cycle.start).toEqual(local(2025, 3, 15, 0));
		expect(cycle.end).toEqual(local(2025, 4, 15, 0));
		expect(totalDaysInCycle(cycle)).toBe(31);
	});

	it("returns a cycle from the previous month's anchor when now < anchor", () => {
		// Anchor 25, today is the 10th → cycle is [Feb 25, Mar 25).
		const cycle = getCurrentCycle(local(2025, 3, 10), 25);
		expect(cycle.start).toEqual(local(2025, 2, 25, 0));
		expect(cycle.end).toEqual(local(2025, 3, 25, 0));
	});

	it("treats now exactly at the anchor as the start of this cycle (boundary)", () => {
		// Anchor 1, now is Jan 1 → cycle is [Jan 1, Feb 1).
		const cycle = getCurrentCycle(local(2025, 1, 1, 0, 0), 1);
		expect(cycle.start).toEqual(local(2025, 1, 1, 0));
		expect(cycle.end).toEqual(local(2025, 2, 1, 0));
		expect(elapsedDaysInCycle(cycle, local(2025, 1, 1, 0, 0))).toBe(1);
	});

	it("short-month fallback: anchor 31 in non-leap February → Feb 28", () => {
		// Now is Feb 10 2025 (non-leap), anchor 31 → previous anchor was Jan 31,
		// next is Feb 28 (since Feb has no 31). Cycle: [Jan 31, Feb 28).
		const cycle = getCurrentCycle(local(2025, 2, 10), 31);
		expect(cycle.start).toEqual(local(2025, 1, 31, 0));
		expect(cycle.end).toEqual(local(2025, 2, 28, 0));
		expect(totalDaysInCycle(cycle)).toBe(28);
	});

	it("short-month fallback: anchor 31 in leap February → Feb 29", () => {
		// 2024 is a leap year. Now Feb 15 2024, anchor 31 → [Jan 31, Feb 29).
		const cycle = getCurrentCycle(local(2024, 2, 15), 31);
		expect(cycle.start).toEqual(local(2024, 1, 31, 0));
		expect(cycle.end).toEqual(local(2024, 2, 29, 0));
		expect(totalDaysInCycle(cycle)).toBe(29);
	});

	it("short-month fallback applied to the START when now is in the short month past the clamp", () => {
		// Anchor 31, now is Feb 28 2025 → start should be Feb 28 (the clamped
		// anchor for this month), end is Mar 31.
		const cycle = getCurrentCycle(local(2025, 2, 28), 31);
		expect(cycle.start).toEqual(local(2025, 2, 28, 0));
		expect(cycle.end).toEqual(local(2025, 3, 31, 0));
		expect(totalDaysInCycle(cycle)).toBe(31);
	});

	it("rejects out-of-range anchors", () => {
		expect(() => getCurrentCycle(local(2025, 5, 1), 0)).toThrow();
		expect(() => getCurrentCycle(local(2025, 5, 1), 32)).toThrow();
		expect(() => getCurrentCycle(local(2025, 5, 1), 1.5)).toThrow();
	});

	it("crosses year boundary correctly", () => {
		// Anchor 15, now is Jan 5 → cycle [Dec 15 2024, Jan 15 2025).
		const cycle = getCurrentCycle(local(2025, 1, 5), 15);
		expect(cycle.start).toEqual(local(2024, 12, 15, 0));
		expect(cycle.end).toEqual(local(2025, 1, 15, 0));
		expect(totalDaysInCycle(cycle)).toBe(31);
	});
});

describe("elapsedDaysInCycle", () => {
	it("returns 1 on the anchor day itself", () => {
		const cycle = getCurrentCycle(local(2025, 3, 15), 15);
		expect(elapsedDaysInCycle(cycle, local(2025, 3, 15))).toBe(1);
	});

	it("returns total days on the day before the next anchor", () => {
		const cycle = getCurrentCycle(local(2025, 3, 15), 15);
		// total = 31 (Mar has 31). Day 31 of cycle is Apr 14.
		expect(elapsedDaysInCycle(cycle, local(2025, 4, 14))).toBe(31);
		expect(totalDaysInCycle(cycle)).toBe(31);
	});

	it("mid-cycle returns the expected day number", () => {
		const cycle = getCurrentCycle(local(2025, 3, 25), 15);
		// Mar 25 - Mar 15 = day 11.
		expect(elapsedDaysInCycle(cycle, local(2025, 3, 25))).toBe(11);
	});
});
