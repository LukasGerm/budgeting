import { describe, expect, it } from "vitest";
import { Money } from "./money";
import { formatMonthlyStatus } from "./monthly-status";

// Expectations are built from `Money.format()` rather than hardcoded literals:
// the EUR formatter separates the amount and the € sign with a non-breaking
// space (U+00A0), so a hand-typed "187,00 €" would silently mismatch.
describe("formatMonthlyStatus", () => {
	it("reads 'X € left of Y € · day N of M' when remaining is positive", () => {
		const remaining = Money.fromCents(18700);
		const budget = Money.fromCents(30000);
		expect(formatMonthlyStatus(remaining, budget, 18, 31)).toBe(
			`${remaining.format()} left of ${budget.format()} · day 18 of 31`,
		);
	});

	it("keeps the normal line when remaining is exactly zero (not over budget)", () => {
		const budget = Money.fromCents(30000);
		expect(formatMonthlyStatus(Money.zero(), budget, 31, 31)).toBe(
			`${Money.zero().format()} left of ${budget.format()} · day 31 of 31`,
		);
	});

	it("reads '-X € over budget' when remaining is negative", () => {
		const remaining = Money.fromCents(-4700);
		expect(formatMonthlyStatus(remaining, Money.fromCents(30000), 18, 31)).toBe(
			`${remaining.format()} over budget`,
		);
	});

	it("over-budget copy omits the day/total context entirely", () => {
		const remaining = Money.fromCents(-1000);
		const line = formatMonthlyStatus(remaining, Money.fromCents(30000), 20, 30);
		expect(line).toBe(`${remaining.format()} over budget`);
		expect(line).not.toContain("day");
		expect(line).not.toContain("left of");
	});

	it("over-budget copy is sign-led: starts with a leading minus", () => {
		const line = formatMonthlyStatus(
			Money.fromCents(-4700),
			Money.fromCents(30000),
			18,
			31,
		);
		expect(line.startsWith("-")).toBe(true);
	});
});
