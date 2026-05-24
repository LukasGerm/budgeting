import { describe, expect, it } from "vitest";
import {
	calculateAvailableToday,
	calculateMonthlyRemaining,
} from "./calculations";
import { Money } from "./money";
import type { Budget, Expense } from "./types";

function local(y: number, m: number, d: number, hh = 12, mm = 0): Date {
	return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** 300 € a month, anchor on the 1st → 31-day cycle in a 31-day month. */
const budget300_anchor1: Budget = {
	monthlyAmount: Money.fromCents(30_000),
	anchorDay: 1,
};

function expense(
	amountCents: number,
	at: Date,
	id = crypto.randomUUID(),
): Expense {
	return {
		id,
		amount: Money.fromCents(amountCents),
		note: null,
		createdAt: at,
	};
}

describe("calculateAvailableToday", () => {
	it("day 1, no spend → daily rate (= monthly / total_days)", () => {
		// March has 31 days. Day 1: 1 * 300 / 31 = 9.677… → 9,67 € (trunc).
		const got = calculateAvailableToday(
			budget300_anchor1,
			[],
			local(2025, 3, 1),
		);
		expect(got.toCents()).toBe(967);
	});

	it("mid-cycle, no spend → cumulative entitlement", () => {
		// Day 18 of 31: 18 * 300 / 31 = 174,19…
		const got = calculateAvailableToday(
			budget300_anchor1,
			[],
			local(2025, 3, 18),
		);
		expect(got.toCents()).toBe(17_419);
	});

	it("last day of cycle, no spend → full monthly budget", () => {
		// Day 31 of 31 = 31 * 300 / 31 = 300,00.
		const got = calculateAvailableToday(
			budget300_anchor1,
			[],
			local(2025, 3, 31),
		);
		expect(got.toCents()).toBe(30_000);
	});

	it("subtracts in-cycle spend", () => {
		// Day 18 → entitlement 17 419 cents. Spend 50,00 € today → 124,19 €.
		const got = calculateAvailableToday(
			budget300_anchor1,
			[expense(5_000, local(2025, 3, 18, 10))],
			local(2025, 3, 18),
		);
		expect(got.toCents()).toBe(17_419 - 5_000);
	});

	it("ignores expenses from outside the current cycle", () => {
		// Same March 18 today; expense from Feb (previous cycle) must not count.
		const got = calculateAvailableToday(
			budget300_anchor1,
			[expense(10_000, local(2025, 2, 14))],
			local(2025, 3, 18),
		);
		expect(got.toCents()).toBe(17_419);
	});

	it("returns a negative value when spend exceeds entitlement (no clamp)", () => {
		// Day 5 of 31 → entitlement = 5*300/31 = 48,38… i.e. 4 838 cents.
		// Spend 100 € → daily = 4 838 − 10 000 = -5 162 cents.
		const got = calculateAvailableToday(
			budget300_anchor1,
			[expense(10_000, local(2025, 3, 5, 9))],
			local(2025, 3, 5),
		);
		expect(got.toCents()).toBe(4_838 - 10_000);
		expect(got.isNegative()).toBe(true);
	});

	it("mid-cycle budget change is reflected immediately", () => {
		const expenses = [expense(5_000, local(2025, 3, 10))];

		const before = calculateAvailableToday(
			budget300_anchor1,
			expenses,
			local(2025, 3, 18),
		);
		expect(before.toCents()).toBe(17_419 - 5_000);

		// User raises budget to 500 € mid-cycle. Same expenses, same day.
		const after = calculateAvailableToday(
			{ ...budget300_anchor1, monthlyAmount: Money.fromCents(50_000) },
			expenses,
			local(2025, 3, 18),
		);
		// 18 * 500 / 31 = 290,32…
		expect(after.toCents()).toBe(29_032 - 5_000);
	});

	it("respects short-month fallback for the cycle bounds", () => {
		// Anchor 31, today Feb 10 2025 → cycle [Jan 31, Feb 28), 28 days.
		// Day 11 of 28: 11 * 300 / 28 = 117,85…
		const got = calculateAvailableToday(
			{ ...budget300_anchor1, anchorDay: 31 },
			[],
			local(2025, 2, 10),
		);
		expect(got.toCents()).toBe(11_785);
	});
});

describe("calculateMonthlyRemaining", () => {
	it("equals the monthly budget when there's no spend", () => {
		const got = calculateMonthlyRemaining(
			budget300_anchor1,
			[],
			local(2025, 3, 18),
		);
		expect(got.equals(Money.fromCents(30_000))).toBe(true);
	});

	it("subtracts in-cycle spend", () => {
		const got = calculateMonthlyRemaining(
			budget300_anchor1,
			[
				expense(2_000, local(2025, 3, 2)),
				expense(8_000, local(2025, 3, 10)),
				// Out-of-cycle: ignored.
				expense(99_999, local(2025, 2, 14)),
			],
			local(2025, 3, 18),
		);
		expect(got.toCents()).toBe(30_000 - 10_000);
	});

	it("goes negative on overspend", () => {
		const got = calculateMonthlyRemaining(
			budget300_anchor1,
			[expense(40_000, local(2025, 3, 5))],
			local(2025, 3, 18),
		);
		expect(got.toCents()).toBe(-10_000);
		expect(got.isNegative()).toBe(true);
	});
});
