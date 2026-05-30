import { describe, expect, it } from "vitest";
import { Money } from "./money";
import { computeStreaks } from "./streak";
import type { Budget, Expense } from "./types";

/** Local-time Date from y/m/d (month 1-indexed), defaulting to midday. */
function local(y: number, m: number, d: number, hh = 12, mm = 0): Date {
	return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** 300 €/month, anchor 1 → 31-day March cycle, daily rate = 30000/31 = 967. */
const budget: Budget = {
	monthlyAmount: Money.fromCents(30_000),
	anchorDay: 1,
};

const UNDER = 500; // ≤ 967 (March) and ≤ 1071 (Feb): under-rate in both cycles
const OVER = 5_000; // > any daily rate here

function spend(amountCents: number, at: Date): Expense {
	return {
		id: crypto.randomUUID(),
		kind: "spend",
		amount: Money.fromCents(amountCents),
		note: null,
		createdAt: at,
	};
}

function adjustment(amountCents: number, at: Date): Expense {
	return {
		id: crypto.randomUUID(),
		kind: "adjustment",
		amount: Money.fromCents(amountCents),
		note: null,
		createdAt: at,
	};
}

describe("computeStreaks", () => {
	it("empty history → both streaks 0/0", () => {
		const got = computeStreaks([], budget, local(2025, 3, 20));
		expect(got).toEqual({
			underRate: { current: 0, best: 0 },
			noSpend: { current: 0, best: 0 },
		});
	});

	it("a single under-rate spend today → under-rate 1, no-spend 0", () => {
		const got = computeStreaks(
			[spend(UNDER, local(2025, 3, 20, 10))],
			budget,
			local(2025, 3, 20),
		);
		expect(got.underRate).toEqual({ current: 1, best: 1 });
		expect(got.noSpend).toEqual({ current: 0, best: 0 });
	});

	it("a single over-rate spend today → today drops off provisionally (0)", () => {
		const got = computeStreaks(
			[spend(OVER, local(2025, 3, 20, 10))],
			budget,
			local(2025, 3, 20),
		);
		expect(got.underRate).toEqual({ current: 0, best: 0 });
		expect(got.noSpend).toEqual({ current: 0, best: 0 });
	});

	it("a no-spend day today counts (above a prior spend day)", () => {
		// First spend yesterday anchors the active range; today has no spend.
		const got = computeStreaks(
			[spend(UNDER, local(2025, 3, 19, 10))],
			budget,
			local(2025, 3, 20),
		);
		// today (0) + yesterday (under) both under-rate.
		expect(got.underRate).toEqual({ current: 2, best: 2 });
		// only today is a no-spend day (yesterday had a spend).
		expect(got.noSpend).toEqual({ current: 1, best: 1 });
	});

	describe("provisional today", () => {
		const priorUnderDays = [
			spend(UNDER, local(2025, 3, 18, 10)),
			spend(UNDER, local(2025, 3, 19, 10)),
		];

		it("counts today while it is within rate", () => {
			const got = computeStreaks(
				[...priorUnderDays, spend(UNDER, local(2025, 3, 20, 10))],
				budget,
				local(2025, 3, 20),
			);
			expect(got.underRate.current).toBe(3);
		});

		it("drops today off (without breaking) when it goes over rate", () => {
			const got = computeStreaks(
				[...priorUnderDays, spend(OVER, local(2025, 3, 20, 10))],
				budget,
				local(2025, 3, 20),
			);
			// Today dropped off; the run ending yesterday (2 days) still shows.
			expect(got.underRate.current).toBe(2);
		});

		it("counts today again once it is back under rate (e.g. after an edit)", () => {
			const got = computeStreaks(
				[...priorUnderDays, spend(UNDER, local(2025, 3, 20, 10))],
				budget,
				local(2025, 3, 20),
			);
			expect(got.underRate.current).toBe(3);
		});
	});

	it("best diverges from current (a long broken run, then a short current run)", () => {
		const entries = [
			spend(UNDER, local(2025, 3, 14, 10)), // ┐
			spend(UNDER, local(2025, 3, 15, 10)), // │ run of 4
			spend(UNDER, local(2025, 3, 16, 10)), // │
			spend(UNDER, local(2025, 3, 17, 10)), // ┘
			spend(OVER, local(2025, 3, 18, 10)), // breaks
			spend(UNDER, local(2025, 3, 19, 10)), // ┐ current run of 2
			spend(UNDER, local(2025, 3, 20, 10)), // ┘ (today)
		];
		const got = computeStreaks(entries, budget, local(2025, 3, 20));
		expect(got.underRate).toEqual({ current: 2, best: 4 });
	});

	it("continues across an anchor-day cycle boundary", () => {
		// anchor 1: Feb cycle (28 days) → March cycle (31 days). UNDER is under
		// rate in both, so the streak spans the Mar 1 reset.
		const entries = [
			spend(UNDER, local(2025, 2, 27, 10)),
			spend(UNDER, local(2025, 2, 28, 10)),
			spend(UNDER, local(2025, 3, 1, 10)),
			spend(UNDER, local(2025, 3, 2, 10)),
			spend(UNDER, local(2025, 3, 3, 10)),
		];
		const got = computeStreaks(entries, budget, local(2025, 3, 3));
		expect(got.underRate.current).toBe(5);
	});

	it("judges each day against its own cycle's daily rate", () => {
		// 1000 cents: under Feb's rate (30000/28 = 1071) but over March's (967).
		const inFeb = computeStreaks(
			[spend(1_000, local(2025, 2, 28, 10))],
			budget,
			local(2025, 2, 28),
		);
		expect(inFeb.underRate.current).toBe(1); // 1000 ≤ 1071

		const inMar = computeStreaks(
			[spend(1_000, local(2025, 3, 1, 10))],
			budget,
			local(2025, 3, 1),
		);
		expect(inMar.underRate.current).toBe(0); // 1000 > 967 → today drops off
	});

	describe("adjustments are excluded", () => {
		it("a day with only adjustments counts as no-spend and doesn't break the run", () => {
			const entries = [
				spend(UNDER, local(2025, 3, 1, 10)), // anchors the range
				adjustment(100_000, local(2025, 3, 3, 10)), // set-aside, no spend
				adjustment(-50_000, local(2025, 3, 4, 10)), // top-up, no spend
				// Mar 2 and Mar 5 (today) have no entries at all.
			];
			const got = computeStreaks(entries, budget, local(2025, 3, 5));
			expect(got.underRate.current).toBe(5); // Mar 1..5 all under-rate
			expect(got.noSpend.current).toBe(4); // Mar 2..5 (Mar 1 had a spend)
		});

		it("a large set-aside on an under-rate spend day does not push it over", () => {
			const got = computeStreaks(
				[
					spend(UNDER, local(2025, 3, 20, 9)),
					adjustment(100_000, local(2025, 3, 20, 10)),
				],
				budget,
				local(2025, 3, 20),
			);
			// Only the 500-cent spend counts toward the day total, not the 100000.
			expect(got.underRate.current).toBe(1);
		});

		it("never extend a streak: result is identical with the adjustments removed", () => {
			const base = [
				spend(UNDER, local(2025, 3, 1, 10)),
				spend(UNDER, local(2025, 3, 2, 10)),
				spend(UNDER, local(2025, 3, 3, 10)),
			];
			const withAdjustments = [
				...base,
				adjustment(100_000, local(2025, 3, 2, 12)),
				adjustment(-25_000, local(2025, 3, 3, 12)),
			];
			const now = local(2025, 3, 3);
			expect(computeStreaks(withAdjustments, budget, now)).toEqual(
				computeStreaks(base, budget, now),
			);
		});
	});

	it("bins by local calendar day across a DST transition (no day dropped)", () => {
		// Europe DST springs forward on 2025-03-30. Three consecutive calendar
		// days of under-rate spend should read as a 3-day run regardless of the
		// 23-hour day. (Anchor 30 keeps all three in one cycle.)
		const dstBudget: Budget = {
			monthlyAmount: Money.fromCents(30_000),
			anchorDay: 30,
		};
		const entries = [
			spend(UNDER, local(2025, 3, 29, 10)),
			spend(UNDER, local(2025, 3, 30, 10)),
			spend(UNDER, local(2025, 3, 31, 10)),
		];
		const got = computeStreaks(entries, dstBudget, local(2025, 3, 31));
		expect(got.underRate.current).toBe(3);
	});

	it("caps both current and best at the lookback window", () => {
		// 10 consecutive under-rate days, window of 5 → capped at 5.
		const entries = Array.from({ length: 10 }, (_, i) =>
			spend(UNDER, local(2025, 3, 20 - i, 10)),
		);
		const got = computeStreaks(entries, budget, local(2025, 3, 20), 5);
		expect(got.underRate.current).toBe(5);
		expect(got.underRate.best).toBe(5);
	});
});
