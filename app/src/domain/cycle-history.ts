/**
 * Cycle history — the most recent `count` budget cycles, newest → oldest.
 *
 * This is the cross-cycle counterpart to `getCurrentCycle`: where that returns
 * the single cycle containing `now`, `getRecentCycles` walks the same anchor
 * logic *backwards* to produce a contiguous run of cycles ending at the current
 * one.
 *
 * It deliberately reuses `getCurrentCycle` for every step rather than
 * re-deriving boundaries, so all the hard-won correctness lives in one place:
 *   - anchor-day clamping for short months / leap years (anchor 31 → Feb 28/29),
 *   - local-midnight `start`/`end` boundaries,
 *   - DST-safe day handling.
 * Stepping back is done by asking `getCurrentCycle` for the cycle that contains
 * an instant *just before* the previous cycle's end — never by subtracting raw
 * milliseconds — so none of those properties can drift.
 *
 * Pure: no React, Prisma, or tRPC.
 */

import type { Cycle } from "./cycle";
import { getCurrentCycle } from "./cycle";

/**
 * The `count` most recent cycles for the given anchor day, **newest → oldest**.
 *
 * `cycles[0]` is the cycle currently containing `now`; each subsequent entry is
 * the cycle immediately before it. The run is contiguous and half-open: for
 * every adjacent pair, `cycles[i].start === cycles[i + 1].end` (the newer
 * cycle's start is the older cycle's end).
 *
 * Algorithm: start from `getCurrentCycle(now, anchorDay)`. The previous cycle
 * ends exactly at the current cycle's `start` (the interval is `[start, end)`),
 * so its containing instant is *one day before* that start. We compute that via
 * `getCurrentCycle`'s own anchor logic by passing a local-midnight Date for
 * `start − 1 day` (built from the y/m/d triple so it stays local-midnight and
 * DST-safe), then repeat. Because each step goes through `getCurrentCycle`, the
 * short-month/leap-year clamping and local-midnight boundaries are preserved for
 * free — e.g. anchor 31 stepping through February yields a cycle bounded at
 * Feb 28 (or 29 in a leap year).
 *
 * `count` must be a positive integer. `anchorDay` validation is delegated to
 * `getCurrentCycle` (1–31).
 */
export function getRecentCycles(
	now: Date,
	anchorDay: number,
	count: number,
): Cycle[] {
	if (!Number.isInteger(count) || count < 1) {
		throw new Error(`count must be a positive integer, got ${count}`);
	}

	const cycles: Cycle[] = [];
	let cycle = getCurrentCycle(now, anchorDay);
	cycles.push(cycle);

	for (let i = 1; i < count; i++) {
		// The previous cycle ends at this cycle's start. Pick an instant that
		// safely lands inside the previous cycle: the local-midnight day *before*
		// `start`. Building from the (y, m, d) triple keeps it local-midnight and
		// sidesteps DST (no raw millisecond subtraction across a 23/25-hour day).
		const dayBeforeStart = new Date(
			cycle.start.getFullYear(),
			cycle.start.getMonth(),
			cycle.start.getDate() - 1,
			0,
			0,
			0,
			0,
		);
		cycle = getCurrentCycle(dayBeforeStart, anchorDay);
		cycles.push(cycle);
	}

	return cycles;
}
