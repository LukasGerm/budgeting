import { describe, expect, it } from "vitest";
import { Money } from "./money";
import { getMonthlyStatus } from "./monthly-status";

describe("getMonthlyStatus", () => {
	it("returns on_track with correct fields when remaining is positive", () => {
		const remaining = Money.fromCents(18700);
		const budget = Money.fromCents(30000);
		const status = getMonthlyStatus(remaining, budget, 18, 31);

		expect(status.kind).toBe("on_track");
		if (status.kind === "on_track") {
			expect(status.remainingCents).toBe(18700);
			expect(status.budgetCents).toBe(30000);
			expect(status.elapsedDays).toBe(18);
			expect(status.totalDays).toBe(31);
		}
	});

	it("returns on_track when remaining is exactly zero (zero is not over budget)", () => {
		const budget = Money.fromCents(30000);
		const status = getMonthlyStatus(Money.zero(), budget, 31, 31);

		expect(status.kind).toBe("on_track");
		if (status.kind === "on_track") {
			expect(status.remainingCents).toBe(0);
			expect(status.budgetCents).toBe(30000);
			expect(status.elapsedDays).toBe(31);
			expect(status.totalDays).toBe(31);
		}
	});

	it("returns over_budget with a negative remainingCents when remaining is negative", () => {
		const remaining = Money.fromCents(-4700);
		const status = getMonthlyStatus(remaining, Money.fromCents(30000), 18, 31);

		expect(status.kind).toBe("over_budget");
		if (status.kind === "over_budget") {
			expect(status.remainingCents).toBe(-4700);
		}
	});

	it("over_budget carries no day/budget context in the union", () => {
		const status = getMonthlyStatus(
			Money.fromCents(-1000),
			Money.fromCents(30000),
			20,
			30,
		);

		expect(status.kind).toBe("over_budget");
		// The over_budget branch only has remainingCents — no elapsedDays/totalDays.
		expect("elapsedDays" in status).toBe(false);
		expect("budgetCents" in status).toBe(false);
	});

	it("over_budget remainingCents is negative (sign-led)", () => {
		const status = getMonthlyStatus(
			Money.fromCents(-4700),
			Money.fromCents(30000),
			18,
			31,
		);

		expect(status.kind).toBe("over_budget");
		if (status.kind === "over_budget") {
			expect(status.remainingCents).toBeLessThan(0);
		}
	});
});
