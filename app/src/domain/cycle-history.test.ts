import { describe, expect, it } from "vitest";
import { totalDaysInCycle } from "./cycle";
import { getRecentCycles } from "./cycle-history";

/** Helper: a local-time Date built from y/m/d (month is 1-indexed for tests). */
function local(y: number, m: number, d: number, hh = 12, mm = 0): Date {
	return new Date(y, m - 1, d, hh, mm, 0, 0);
}

describe("getRecentCycles", () => {
	it("returns exactly `count` cycles, newest → oldest", () => {
		// Anchor 1, now Mar 11 → current cycle [Mar 1, Apr 1). Six cycles back to Oct.
		const cycles = getRecentCycles(local(2025, 3, 11), 1, 6);

		expect(cycles).toHaveLength(6);
		// Newest first: the current cycle contains `now`.
		expect(cycles[0].start).toEqual(local(2025, 3, 1, 0));
		expect(cycles[0].end).toEqual(local(2025, 4, 1, 0));
		// Oldest last: 5 months before March is October.
		expect(cycles[5].start).toEqual(local(2024, 10, 1, 0));
		expect(cycles[5].end).toEqual(local(2024, 11, 1, 0));
	});

	it("is contiguous: each cycle's end equals the next-newer cycle's start", () => {
		const cycles = getRecentCycles(local(2025, 3, 11), 15, 6);

		for (let i = 0; i < cycles.length - 1; i++) {
			// cycles[i] is newer than cycles[i + 1]; the older one's end is the
			// newer one's start (half-open intervals tile with no gap/overlap).
			expect(cycles[i + 1].end).toEqual(cycles[i].start);
		}
	});

	it("returns just the current cycle when count is 1", () => {
		const cycles = getRecentCycles(local(2025, 3, 20), 15, 1);

		expect(cycles).toHaveLength(1);
		expect(cycles[0].start).toEqual(local(2025, 3, 15, 0));
		expect(cycles[0].end).toEqual(local(2025, 4, 15, 0));
	});

	it("anchor-day clamping: anchor 31 stepping through February bounds at Feb 28", () => {
		// Anchor 31, now Mar 15 2025 (non-leap). Current cycle [Feb 28, Mar 31)
		// (Feb has no 31, so the clamp puts that boundary on Feb 28). The previous
		// cycle is [Jan 31, Feb 28).
		const cycles = getRecentCycles(local(2025, 3, 15), 31, 3);

		expect(cycles[0].start).toEqual(local(2025, 2, 28, 0));
		expect(cycles[0].end).toEqual(local(2025, 3, 31, 0));
		expect(cycles[1].start).toEqual(local(2025, 1, 31, 0));
		expect(cycles[1].end).toEqual(local(2025, 2, 28, 0));
		expect(totalDaysInCycle(cycles[1])).toBe(28);
		// One step further back: [Dec 31 2024, Jan 31 2025).
		expect(cycles[2].start).toEqual(local(2024, 12, 31, 0));
		expect(cycles[2].end).toEqual(local(2025, 1, 31, 0));
	});

	it("leap year: anchor 31 stepping through Feb 2024 bounds at Feb 29", () => {
		// 2024 is a leap year. Anchor 31, now Mar 10 2024 → current [Feb 29, Mar 31).
		// Previous cycle [Jan 31, Feb 29) is 29 days.
		const cycles = getRecentCycles(local(2024, 3, 10), 31, 2);

		expect(cycles[0].start).toEqual(local(2024, 2, 29, 0));
		expect(cycles[0].end).toEqual(local(2024, 3, 31, 0));
		expect(cycles[1].start).toEqual(local(2024, 1, 31, 0));
		expect(cycles[1].end).toEqual(local(2024, 2, 29, 0));
		expect(totalDaysInCycle(cycles[1])).toBe(29);
	});

	it("crosses the December → January year boundary correctly", () => {
		// Anchor 15, now Jan 5 2025 → current cycle [Dec 15 2024, Jan 15 2025).
		// The previous cycle is [Nov 15, Dec 15 2024].
		const cycles = getRecentCycles(local(2025, 1, 5), 15, 3);

		expect(cycles[0].start).toEqual(local(2024, 12, 15, 0));
		expect(cycles[0].end).toEqual(local(2025, 1, 15, 0));
		expect(cycles[1].start).toEqual(local(2024, 11, 15, 0));
		expect(cycles[1].end).toEqual(local(2024, 12, 15, 0));
		expect(cycles[2].start).toEqual(local(2024, 10, 15, 0));
		expect(cycles[2].end).toEqual(local(2024, 11, 15, 0));
	});

	it("DST transition (Europe/Berlin spring-forward) doesn't add or drop a day", () => {
		// Europe/Berlin springs forward on 2025-03-30. Anchor 15, now Apr 5 2025 →
		// current cycle [Mar 15, Apr 15) spans the spring-forward. Stepping back
		// across that boundary must still yield clean local-midnight boundaries and
		// the correct 31-day count for March (the 23-hour day must not shave a day).
		const cycles = getRecentCycles(local(2025, 4, 5), 15, 2);

		expect(cycles[0].start).toEqual(local(2025, 3, 15, 0));
		expect(cycles[0].end).toEqual(local(2025, 4, 15, 0));
		expect(totalDaysInCycle(cycles[0])).toBe(31);
		// Previous cycle ends exactly at this cycle's start (no DST drift).
		expect(cycles[1].end).toEqual(cycles[1 - 1].start);
		expect(cycles[1].start).toEqual(local(2025, 2, 15, 0));
		// Feb 15 → Mar 15 is 28 days in 2025 (non-leap), unaffected by DST.
		expect(totalDaysInCycle(cycles[1])).toBe(28);
	});

	it("rejects a non-positive or non-integer count", () => {
		expect(() => getRecentCycles(local(2025, 5, 1), 1, 0)).toThrow();
		expect(() => getRecentCycles(local(2025, 5, 1), 1, -3)).toThrow();
		expect(() => getRecentCycles(local(2025, 5, 1), 1, 2.5)).toThrow();
	});
});
