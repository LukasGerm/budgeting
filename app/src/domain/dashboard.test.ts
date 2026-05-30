import { describe, expect, it } from "vitest";
import { getCurrentCycle } from "./cycle";
import { getRecentCycles } from "./cycle-history";
import {
	biggestSpends,
	compareToLastCycle,
	cumulativePaceSeries,
	cycleSpendSummary,
	cycleTotals,
	dailySpendBuckets,
	projectEndOfCycle,
} from "./dashboard";
import { Money } from "./money";
import type { Budget, Expense } from "./types";

function local(y: number, m: number, d: number, hh = 12, mm = 0): Date {
	return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function expense(
	amountCents: number,
	at: Date,
	id = crypto.randomUUID(),
): Expense {
	return {
		id,
		kind: "spend",
		amount: Money.fromCents(amountCents),
		note: null,
		createdAt: at,
	};
}

/** An adjustment entry — `amountCents` is the *stored* signed amount. */
function adjustment(
	amountCents: number,
	at: Date,
	id = crypto.randomUUID(),
): Expense {
	return {
		id,
		kind: "adjustment",
		amount: Money.fromCents(amountCents),
		note: null,
		createdAt: at,
	};
}

describe("cycleSpendSummary", () => {
	it("happy path: sums spends, averages over elapsed days, counts days left", () => {
		// Anchor 1, March (31-day cycle). Today March 11 → elapsed 11, days left 20.
		// Spends 30 € + 12 € + 8 € = 50 € (5 000). avg = 5 000 / 11 = 454 (trunc).
		const now = local(2025, 3, 11);
		const cycle = getCurrentCycle(now, 1);
		const summary = cycleSpendSummary(
			cycle,
			[
				expense(3_000, local(2025, 3, 2)),
				expense(1_200, local(2025, 3, 6)),
				expense(800, local(2025, 3, 10)),
			],
			now,
		);

		expect(summary.totalSpent.toCents()).toBe(5_000);
		expect(summary.avgPerDay.toCents()).toBe(Math.trunc(5_000 / 11));
		expect(summary.daysLeft).toBe(20);
	});

	it("empty cycle: zeros for spent and avg, full days left", () => {
		// Day 1 of a 31-day cycle, nothing spent → 0 spent, 0/1 avg, 30 days left.
		const now = local(2025, 3, 1);
		const cycle = getCurrentCycle(now, 1);
		const summary = cycleSpendSummary(cycle, [], now);

		expect(summary.totalSpent.toCents()).toBe(0);
		expect(summary.avgPerDay.toCents()).toBe(0);
		expect(summary.daysLeft).toBe(30);
	});

	it("excludes adjustments: totalSpent reflects the SPEND only", () => {
		// Day 11 of March (elapsed 11, days left 20). A 40 € spend (4 000), a 50 €
		// top-up (stored -5 000), and a 10 € set-aside (stored +1 000). Only the
		// spend counts toward totalSpent: 4 000, NOT the net 0.
		const now = local(2025, 3, 11);
		const cycle = getCurrentCycle(now, 1);
		const summary = cycleSpendSummary(
			cycle,
			[
				expense(4_000, local(2025, 3, 3)),
				adjustment(-5_000, local(2025, 3, 5)),
				adjustment(1_000, local(2025, 3, 8)),
			],
			now,
		);

		expect(summary.totalSpent.toCents()).toBe(4_000);
		expect(summary.avgPerDay.toCents()).toBe(Math.trunc(4_000 / 11));
		expect(summary.daysLeft).toBe(20);
	});

	it("last day of the cycle clamps daysLeft to 0", () => {
		// Day 31 of 31 → elapsed 31, days left 0 (not negative).
		const now = local(2025, 3, 31);
		const cycle = getCurrentCycle(now, 1);
		const summary = cycleSpendSummary(cycle, [], now);

		expect(summary.daysLeft).toBe(0);
	});
});

describe("cumulativePaceSeries", () => {
	// 300 €/mo, anchor 1, March → 31-day cycle. Ideal/day = 30 000/31.
	const monthly300 = Money.fromCents(30_000);

	it("series shape: one point per elapsed day, none in the future", () => {
		// March 11 → elapsed 11. Days run 1..11 contiguously; last day == elapsed.
		const now = local(2025, 3, 11);
		const cycle = getCurrentCycle(now, 1);
		const series = cumulativePaceSeries(cycle, [], monthly300, now);

		expect(series).toHaveLength(11);
		expect(series.map((p) => p.day)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
		]);
		expect(series.at(-1)?.day).toBe(11);
	});

	it("actual is the running net cumulation; ideal is the straight line (floored)", () => {
		// Spends: 10 € on day 2, 20 € on day 6. March 11 → elapsed 11, 31-day cycle.
		// actualNet: 0 through day 1, 1 000 from day 2, 3 000 from day 6 onward.
		// idealNet[day] = trunc(30 000 * day / 31).
		const now = local(2025, 3, 11);
		const cycle = getCurrentCycle(now, 1);
		const series = cumulativePaceSeries(
			cycle,
			[expense(1_000, local(2025, 3, 2)), expense(2_000, local(2025, 3, 6))],
			monthly300,
			now,
		);

		expect(series[0].actualNet).toBe(0); // day 1, nothing yet
		expect(series[1].actualNet).toBe(1_000); // day 2, +10 €
		expect(series[4].actualNet).toBe(1_000); // day 5, still 10 €
		expect(series[5].actualNet).toBe(3_000); // day 6, +20 €
		expect(series.at(-1)?.actualNet).toBe(3_000); // day 11

		// Ideal is the straight line, floored.
		expect(series[0].idealNet).toBe(Math.trunc((30_000 * 1) / 31));
		expect(series[5].idealNet).toBe(Math.trunc((30_000 * 6) / 31));
		expect(series.at(-1)?.idealNet).toBe(Math.trunc((30_000 * 11) / 31));
	});

	it("empty cycle: every actualNet is 0, idealNet rises linearly", () => {
		// Day 5 of a 31-day cycle, no entries.
		const now = local(2025, 3, 5);
		const cycle = getCurrentCycle(now, 1);
		const series = cumulativePaceSeries(cycle, [], monthly300, now);

		expect(series).toHaveLength(5);
		expect(series.every((p) => p.actualNet === 0)).toBe(true);
		for (const p of series) {
			expect(p.idealNet).toBe(Math.trunc((30_000 * p.day) / 31));
		}
		// Strictly increasing ideal line.
		for (let i = 1; i < series.length; i++) {
			expect(series[i].idealNet).toBeGreaterThan(series[i - 1].idealNet);
		}
	});

	it("day-1-only cycle still emits day 1 reflecting that day's entries", () => {
		// elapsed is always ≥1: on the anchor day a same-day spend is in day 1.
		const now = local(2025, 3, 1);
		const cycle = getCurrentCycle(now, 1);
		const series = cumulativePaceSeries(
			cycle,
			[expense(500, local(2025, 3, 1, 9))],
			monthly300,
			now,
		);

		expect(series).toHaveLength(1);
		expect(series[0]).toMatchObject({ day: 1, actualNet: 500 });
		expect(series[0].idealNet).toBe(Math.trunc((30_000 * 1) / 31));
	});

	it("mixed fixture: actualNet reflects NET (top-up lowers, set-aside raises)", () => {
		// Day 11. A 40 € spend (4 000) on day 3, a 50 € top-up (stored -5 000) on
		// day 5, a 10 € set-aside (stored +1 000) on day 8.
		// Net cumulation: day 3 → 4 000, day 5 → -1 000, day 8 → 0.
		// (Contrast cycleSpendSummary, which counts only the 4 000 spend.)
		const now = local(2025, 3, 11);
		const cycle = getCurrentCycle(now, 1);
		const series = cumulativePaceSeries(
			cycle,
			[
				expense(4_000, local(2025, 3, 3)),
				adjustment(-5_000, local(2025, 3, 5)),
				adjustment(1_000, local(2025, 3, 8)),
			],
			monthly300,
			now,
		);

		expect(series[2].actualNet).toBe(4_000); // day 3: spend only
		expect(series[4].actualNet).toBe(-1_000); // day 5: top-up pulls it negative
		expect(series[7].actualNet).toBe(0); // day 8: set-aside lifts back to 0
		expect(series.at(-1)?.actualNet).toBe(0); // day 11: unchanged net
	});
});

describe("projectEndOfCycle", () => {
	// 300 €/mo, anchor 1 → March is a 31-day cycle.
	const budget: Budget = {
		monthlyAmount: Money.fromCents(30_000),
		anchorDay: 1,
	};

	it("normal mid-cycle projection that lands UNDER budget", () => {
		// Day 11 (elapsed 11), 31-day cycle. Net so far = 50 € (5 000).
		// projectedNet = trunc(5 000 × 31 / 11) = trunc(155 000 / 11) = 14 090.
		// 14 090 < 30 000 → under; difference = 30 000 − 14 090 = 15 910.
		const now = local(2025, 3, 11);
		const result = projectEndOfCycle(
			budget,
			[
				expense(3_000, local(2025, 3, 2)),
				expense(1_200, local(2025, 3, 6)),
				expense(800, local(2025, 3, 10)),
			],
			now,
		);

		expect(result.suppressed).toBe(false);
		if (result.suppressed) return; // narrow for TS
		expect(result.overUnder).toBe("under");
		expect(result.projectedNet.toCents()).toBe(Math.trunc((5_000 * 31) / 11));
		expect(result.projectedNet.toCents()).toBe(14_090);
		expect(result.difference.toCents()).toBe(30_000 - 14_090);
	});

	it("mid-cycle projection that lands OVER budget", () => {
		// Day 11 (elapsed 11). Net so far = 150 € (15 000).
		// projectedNet = trunc(15 000 × 31 / 11) = trunc(465 000 / 11) = 42 272.
		// 42 272 > 30 000 → over; difference = 42 272 − 30 000 = 12 272.
		const now = local(2025, 3, 11);
		const result = projectEndOfCycle(
			budget,
			[expense(10_000, local(2025, 3, 2)), expense(5_000, local(2025, 3, 8))],
			now,
		);

		expect(result.suppressed).toBe(false);
		if (result.suppressed) return;
		expect(result.overUnder).toBe("over");
		expect(result.projectedNet.toCents()).toBe(Math.trunc((15_000 * 31) / 11));
		expect(result.projectedNet.toCents()).toBe(42_272);
		expect(result.difference.toCents()).toBe(42_272 - 30_000);
	});

	it("early-cycle suppression boundary: day 1 suppressed, day 2 shown", () => {
		// Threshold is elapsed < 2: suppressed on the anchor day (day 1) only.
		const day1 = projectEndOfCycle(
			budget,
			[expense(1_000, local(2025, 3, 1, 9))],
			local(2025, 3, 1),
		);
		expect(day1.suppressed).toBe(true);

		// Day 2 (elapsed 2) → not suppressed; the projection appears here first.
		const day2 = projectEndOfCycle(
			budget,
			[expense(1_000, local(2025, 3, 1, 9))],
			local(2025, 3, 2),
		);
		expect(day2.suppressed).toBe(false);
	});

	it("net basis: top-up lowers and set-aside raises the projection (not spend-only)", () => {
		// Day 11 (elapsed 11). 200 € spend (20 000), 30 € top-up (stored -3 000),
		// 10 € set-aside (stored +1 000) → net so far = 18 000 (NOT the 20 000 spend).
		// projectedNet (net) = trunc(18 000 × 31 / 11) = trunc(558 000 / 11) = 50 727.
		// A spend-only projection would be trunc(20 000 × 31 / 11) = 56 363 — different,
		// proving the figure is driven by net, not spend.
		const now = local(2025, 3, 11);
		const result = projectEndOfCycle(
			budget,
			[
				expense(20_000, local(2025, 3, 3)),
				adjustment(-3_000, local(2025, 3, 5)),
				adjustment(1_000, local(2025, 3, 8)),
			],
			now,
		);

		expect(result.suppressed).toBe(false);
		if (result.suppressed) return;
		expect(result.projectedNet.toCents()).toBe(Math.trunc((18_000 * 31) / 11));
		expect(result.projectedNet.toCents()).toBe(50_727);
		// Net-driven, not spend-only.
		expect(result.projectedNet.toCents()).not.toBe(
			Math.trunc((20_000 * 31) / 11),
		);
		expect(result.overUnder).toBe("over");
		expect(result.difference.toCents()).toBe(50_727 - 30_000);
	});
});

describe("dailySpendBuckets", () => {
	// 300 €/mo, anchor 1, March → 31-day cycle. Daily allowance = 30 000/31 ≈ 967.74.
	const monthly300 = Money.fromCents(30_000);
	const cycle = getCurrentCycle(local(2025, 3, 11), 1);

	it("emits one bucket per day of the FULL cycle (not just elapsed)", () => {
		const { buckets } = dailySpendBuckets(cycle, [], monthly300);

		expect(buckets).toHaveLength(31);
		expect(buckets[0].day).toBe(1);
		expect(buckets.at(-1)?.day).toBe(31);
		// Contiguous, 1-based.
		expect(buckets.map((b) => b.day)).toEqual(
			Array.from({ length: 31 }, (_, i) => i + 1),
		);
	});

	it("sums multiple spends on the same day into one bucket", () => {
		const { buckets } = dailySpendBuckets(
			cycle,
			[
				expense(1_000, local(2025, 3, 2, 9)),
				expense(500, local(2025, 3, 2, 18)),
			],
			monthly300,
		);

		expect(buckets[1].spentCents).toBe(1_500); // day 2
	});

	it("lands spends on different days in different buckets; no-spend days are 0", () => {
		const { buckets } = dailySpendBuckets(
			cycle,
			[expense(1_000, local(2025, 3, 2)), expense(2_000, local(2025, 3, 5))],
			monthly300,
		);

		expect(buckets[1].spentCents).toBe(1_000); // day 2
		expect(buckets[4].spentCents).toBe(2_000); // day 5
		expect(buckets[0].spentCents).toBe(0); // day 1, no spend
		expect(buckets[2].spentCents).toBe(0); // day 3, no spend
	});

	it("flags days over the daily allowance and not days under it", () => {
		// Daily allowance = 30 000 / 31 ≈ 967.74 cents. 1 000 > it (over); 500 < it.
		const { buckets, dailyAllowanceCents } = dailySpendBuckets(
			cycle,
			[expense(1_000, local(2025, 3, 2)), expense(500, local(2025, 3, 5))],
			monthly300,
		);

		expect(dailyAllowanceCents).toBe(30_000 / 31);
		expect(buckets[1].over).toBe(true); // day 2: 1 000 > 967.74
		expect(buckets[4].over).toBe(false); // day 5: 500 < 967.74
	});

	it("empty cycle: every bucket is 0 and none is over", () => {
		const { buckets } = dailySpendBuckets(cycle, [], monthly300);

		expect(buckets.every((b) => b.spentCents === 0)).toBe(true);
		expect(buckets.some((b) => b.over)).toBe(false);
	});

	it("mixed fixture: only the SPEND contributes (adjustments excluded)", () => {
		// Day 3: a 12 € spend (1 200), a 50 € top-up (stored -5 000), and a 3 €
		// set-aside (stored +300). Only the 1 200 spend counts toward that day's
		// spentCents — NOT the net (1 200 - 5 000 + 300 = -3 500).
		const { buckets } = dailySpendBuckets(
			cycle,
			[
				expense(1_200, local(2025, 3, 3, 8)),
				adjustment(-5_000, local(2025, 3, 3, 9)),
				adjustment(300, local(2025, 3, 3, 10)),
			],
			monthly300,
		);

		expect(buckets[2].spentCents).toBe(1_200); // day 3: spend only
	});
});

describe("cycleTotals", () => {
	// Anchor 1: each cycle is a calendar month. Six cycles back from March 2025
	// → Oct, Nov, Dec 2024, Jan, Feb, Mar 2025 (newest → oldest at index 0).
	const cycles = getRecentCycles(local(2025, 3, 11), 1, 6);

	it("bins each expense into the cycle whose interval contains its createdAt", () => {
		// One spend in March (current), one in February, one in December 2024.
		const totals = cycleTotals(cycles, [
			expense(5_000, local(2025, 3, 4)),
			expense(2_000, local(2025, 2, 20)),
			expense(1_000, local(2024, 12, 9)),
		]);

		expect(totals).toHaveLength(6);
		// Index 0 = March (newest); index 1 = February; index 3 = December 2024.
		expect(totals[0].cycle.start).toEqual(local(2025, 3, 1, 0));
		expect(totals[0].netCents).toBe(5_000);
		expect(totals[0].entryCount).toBe(1);
		expect(totals[1].netCents).toBe(2_000); // February
		expect(totals[3].netCents).toBe(1_000); // December 2024
		// Months with no entries are zero with a zero count.
		expect(totals[2].netCents).toBe(0); // January 2025
		expect(totals[2].entryCount).toBe(0);
	});

	it("ignores expenses outside every cycle (before the oldest, at/after the newest)", () => {
		// Oldest cycle starts Oct 1 2024; newest ends Apr 1 2025. An entry in Sep
		// 2024 and one in Apr 2025 both fall outside the window and are dropped.
		const totals = cycleTotals(cycles, [
			expense(9_999, local(2024, 9, 30)), // before oldest start
			expense(1_500, local(2025, 1, 10)), // inside (January)
			expense(8_888, local(2025, 4, 1)), // at the newest end (excluded, half-open)
		]);

		expect(totals[2].netCents).toBe(1_500); // January 2025
		expect(totals[2].entryCount).toBe(1);
		// Total across all cycles is only the one in-range entry.
		const sum = totals.reduce((acc, t) => acc + t.netCents, 0);
		expect(sum).toBe(1_500);
		const counted = totals.reduce((acc, t) => acc + t.entryCount, 0);
		expect(counted).toBe(1);
	});

	it("mixed fixture: per-cycle figure is NET (spend + top-up + set-aside)", () => {
		// All three entries land in the March cycle: a 40 € spend (4 000), a 50 €
		// top-up (stored -5 000), and a 10 € set-aside (stored +1 000).
		// Net = 4 000 - 5 000 + 1 000 = 0 — but the cycle DID have data (3 entries),
		// so entryCount is 3 (the trend's "has data" rule must see this).
		const totals = cycleTotals(cycles, [
			expense(4_000, local(2025, 3, 3)),
			adjustment(-5_000, local(2025, 3, 5)),
			adjustment(1_000, local(2025, 3, 8)),
		]);

		expect(totals[0].netCents).toBe(0); // net cancels out
		expect(totals[0].entryCount).toBe(3); // but data is present
	});

	it("empty expenses: every cycle is zero net with a zero count", () => {
		const totals = cycleTotals(cycles, []);

		expect(totals.every((t) => t.netCents === 0)).toBe(true);
		expect(totals.every((t) => t.entryCount === 0)).toBe(true);
	});
});

describe("compareToLastCycle", () => {
	// Anchor 1: each cycle is a calendar month. From March 11 2025, cycles[0] is
	// March (31 days) and cycles[1] is February 2025 (28 days). Elapsed at
	// March 11 is 11.
	const now = local(2025, 3, 11);
	const cycles = getRecentCycles(now, 1, 6);

	it("returns null when there is no previous cycle", () => {
		// Only the current cycle → nothing to compare against.
		const single = getRecentCycles(now, 1, 1);
		expect(single).toHaveLength(1);
		expect(compareToLastCycle(single, [], now)).toBeNull();
	});

	it("uses the SAME elapsed day, not the previous cycle's full total", () => {
		// Previous (Feb) has a LARGER full total, but it is concentrated AFTER the
		// elapsed cutoff (day 11). At the same elapsed day the current cycle is ahead.
		//   Feb day 5  (Feb 5):  10 € (1 000)  ← within cutoff (day ≤ 11)
		//   Feb day 20 (Feb 20): 100 € (10 000) ← AFTER cutoff (day 20 > 11)
		//   → Feb full total 11 000, but Feb-at-day-11 is only 1 000.
		//   Mar day 3 (Mar 3): 50 € (5 000) → currentNet 5 000.
		// Same-elapsed-day: 5 000 (current) > 1 000 (last-at-day-11) → "more".
		// A naive full-total comparison (5 000 < 11 000) would wrongly say "less".
		const result = compareToLastCycle(
			cycles,
			[
				expense(1_000, local(2025, 2, 5)),
				expense(10_000, local(2025, 2, 20)),
				expense(5_000, local(2025, 3, 3)),
			],
			now,
		);

		expect(result).not.toBeNull();
		if (!result) return; // narrow for TS
		expect(result.currentNet.toCents()).toBe(5_000);
		expect(result.lastNetAtSameDay.toCents()).toBe(1_000); // NOT the 11 000 full total
		expect(result.direction).toBe("more"); // NOT "less" (the naive answer)
		// pct = round(|5 000 − 1 000| / 1 000 × 100) = 400.
		expect(result.pct).toBe(400);
	});

	it("direction + pct: LESS than last cycle so far", () => {
		// Mar-at-day-11 = 60 € (6 000); Feb-at-day-11 = 100 € (10 000).
		// current < last → "less"; pct = round(|6 000 − 10 000| / 10 000 × 100) = 40.
		const result = compareToLastCycle(
			cycles,
			[expense(10_000, local(2025, 2, 4)), expense(6_000, local(2025, 3, 4))],
			now,
		);

		expect(result).not.toBeNull();
		if (!result) return;
		expect(result.direction).toBe("less");
		expect(result.pct).toBe(40);
		expect(result.currentNet.toCents()).toBe(6_000);
		expect(result.lastNetAtSameDay.toCents()).toBe(10_000);
	});

	it("direction + pct: MORE than last cycle so far", () => {
		// Mar-at-day-11 = 120 € (12 000); Feb-at-day-11 = 80 € (8 000).
		// current > last → "more"; pct = round(|12 000 − 8 000| / 8 000 × 100) = 50.
		const result = compareToLastCycle(
			cycles,
			[expense(8_000, local(2025, 2, 4)), expense(12_000, local(2025, 3, 4))],
			now,
		);

		expect(result).not.toBeNull();
		if (!result) return;
		expect(result.direction).toBe("more");
		expect(result.pct).toBe(50);
	});

	it("direction: SAME when both are equal (pct 0)", () => {
		// Mar-at-day-11 = 50 € (5 000); Feb-at-day-11 = 50 € (5 000) → equal.
		const result = compareToLastCycle(
			cycles,
			[expense(5_000, local(2025, 2, 4)), expense(5_000, local(2025, 3, 4))],
			now,
		);

		expect(result).not.toBeNull();
		if (!result) return;
		expect(result.direction).toBe("same");
		expect(result.pct).toBe(0);
	});

	it("net basis: spend + top-up + set-aside both sides (uses NET, not spend-only)", () => {
		// Both cycles get a 40 € spend (4 000), a 50 € top-up (-5 000), and a 10 €
		// set-aside (+1 000) within the cutoff. Net each side = 4 000 - 5 000 + 1 000
		// = 0 (NOT the 4 000 spend-only). So both are 0 → "same".
		// Add a current-cycle extra spend so the NET differs and proves net is used:
		//   Mar also has a 20 € spend (2 000) → current net = 2 000, last net = 0.
		const result = compareToLastCycle(
			cycles,
			[
				// previous (Feb), within day 11
				expense(4_000, local(2025, 2, 3)),
				adjustment(-5_000, local(2025, 2, 5)),
				adjustment(1_000, local(2025, 2, 8)),
				// current (Mar), within day 11
				expense(4_000, local(2025, 3, 3)),
				adjustment(-5_000, local(2025, 3, 5)),
				adjustment(1_000, local(2025, 3, 8)),
				expense(2_000, local(2025, 3, 9)),
			],
			now,
		);

		expect(result).not.toBeNull();
		if (!result) return;
		// Net, not spend-only: last side cancels to 0 (spend-only would be 4 000).
		expect(result.lastNetAtSameDay.toCents()).toBe(0);
		// Current net = 4 000 - 5 000 + 1 000 + 2 000 = 2 000 (spend-only would be 6 000).
		expect(result.currentNet.toCents()).toBe(2_000);
		// Zero baseline with non-zero current → "more", pct null (documented).
		expect(result.direction).toBe("more");
		expect(result.pct).toBeNull();
	});

	it("zero baseline, both zero: direction same, pct null (no NaN/Infinity)", () => {
		// Previous cycle has nothing within the cutoff and current is also empty.
		const result = compareToLastCycle(cycles, [], now);

		expect(result).not.toBeNull();
		if (!result) return;
		expect(result.currentNet.toCents()).toBe(0);
		expect(result.lastNetAtSameDay.toCents()).toBe(0);
		expect(result.direction).toBe("same");
		expect(result.pct).toBeNull();
		expect(Number.isNaN(result.pct ?? 0)).toBe(false);
	});

	it("zero baseline, current non-zero: direction more, pct null", () => {
		// Last cycle spent nothing by day 11; current spent 30 € (3 000).
		const result = compareToLastCycle(
			cycles,
			[expense(3_000, local(2025, 3, 4))],
			now,
		);

		expect(result).not.toBeNull();
		if (!result) return;
		expect(result.lastNetAtSameDay.toCents()).toBe(0);
		expect(result.currentNet.toCents()).toBe(3_000);
		expect(result.direction).toBe("more");
		expect(result.pct).toBeNull();
	});
});

describe("biggestSpends", () => {
	it("orders spends by amount descending", () => {
		const result = biggestSpends(
			[
				expense(1_000, local(2025, 3, 2)),
				expense(5_000, local(2025, 3, 3)),
				expense(3_000, local(2025, 3, 4)),
			],
			5,
		);

		expect(result.map((e) => e.amount.toCents())).toEqual([
			5_000, 3_000, 1_000,
		]);
	});

	it("includes SPEND only — adjustments are excluded even when larger", () => {
		// A 12 € spend (1 200), a 500 € top-up (stored -50 000), and a 200 €
		// set-aside (stored +20 000). The adjustments dwarf the spend in magnitude,
		// but only the spend may appear.
		const result = biggestSpends(
			[
				expense(1_200, local(2025, 3, 3)),
				adjustment(-50_000, local(2025, 3, 5)),
				adjustment(20_000, local(2025, 3, 8)),
			],
			5,
		);

		expect(result).toHaveLength(1);
		expect(result[0].kind).toBe("spend");
		expect(result[0].amount.toCents()).toBe(1_200);
	});

	it("caps at n, returning the n largest spends", () => {
		const result = biggestSpends(
			[
				expense(1_000, local(2025, 3, 2)),
				expense(5_000, local(2025, 3, 3)),
				expense(3_000, local(2025, 3, 4)),
				expense(8_000, local(2025, 3, 5)),
				expense(2_000, local(2025, 3, 6)),
			],
			3,
		);

		expect(result).toHaveLength(3);
		expect(result.map((e) => e.amount.toCents())).toEqual([
			8_000, 5_000, 3_000,
		]);
	});

	it("returns [] when there are no spends (empty or adjustments only)", () => {
		expect(biggestSpends([], 5)).toEqual([]);
		expect(
			biggestSpends(
				[
					adjustment(-5_000, local(2025, 3, 5)),
					adjustment(1_000, local(2025, 3, 8)),
				],
				5,
			),
		).toEqual([]);
	});

	it("breaks amount ties by newer createdAt first, then id ascending", () => {
		// Two equal-amount spends: the newer one comes first. A third, even-newer
		// spend with the SAME amount AND the SAME createdAt as the newest falls back
		// to id ascending. IDs chosen so lexical order is obvious from the first hex
		// digit (a... < b... < c...).
		const aId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" as const;
		const bId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" as const;
		const cId = "cccccccc-cccc-cccc-cccc-cccccccccccc" as const;
		const older = expense(2_000, local(2025, 3, 2), cId);
		const newer = expense(2_000, local(2025, 3, 9), bId);
		const sameInstant = expense(2_000, local(2025, 3, 9), aId);

		// Input deliberately scrambled so ordering must come from the sort, not input.
		const result = biggestSpends([newer, older, sameInstant], 5);

		// All equal amounts; the two on Mar 9 (newest) come before the Mar 2 one,
		// and between those two the lower id (aId) wins.
		expect(result.map((e) => e.id)).toEqual([aId, bId, cId]);
	});

	it("does not mutate the input array", () => {
		const input = [
			expense(1_000, local(2025, 3, 2)),
			expense(5_000, local(2025, 3, 3)),
			expense(3_000, local(2025, 3, 4)),
		];
		const snapshot = [...input];

		biggestSpends(input, 5);

		expect(input).toEqual(snapshot);
		expect(input.map((e) => e.amount.toCents())).toEqual([1_000, 5_000, 3_000]);
	});
});
