import { describe, expect, it } from "vitest";
import type { EntryKind } from "./entry";
import {
	type AdjustmentDirection,
	adjustmentAmountCents,
	adjustmentDirection,
	sumNet,
	sumSpends,
} from "./entry";
import { Money } from "./money";
import type { Expense } from "./types";

let counter = 0;
function entry(kind: EntryKind, amountCents: number): Expense {
	counter += 1;
	return {
		id: `e${counter}`,
		kind,
		amount: Money.fromCents(amountCents),
		note: null,
		createdAt: new Date(2025, 2, 1, 12),
	};
}

const spend = (cents: number) => entry("spend", cents);
const adjustment = (cents: number) => entry("adjustment", cents);

describe("sumSpends", () => {
	it("sums spends only, ignoring adjustments (top-ups and set-asides)", () => {
		const got = sumSpends([
			spend(1_000),
			spend(500),
			adjustment(-2_000), // top-up: ignored
			adjustment(3_000), // set-aside: ignored
		]);
		expect(got.toCents()).toBe(1_500);
	});

	it("is zero when there are no spends", () => {
		expect(sumSpends([adjustment(-1_000), adjustment(1_000)]).toCents()).toBe(
			0,
		);
		expect(sumSpends([]).toCents()).toBe(0);
	});
});

describe("sumNet", () => {
	it("nets signed adjustments against spends", () => {
		// 1000 spend, minus a 200 top-up (stored -200), plus a 300 set-aside.
		const got = sumNet([spend(1_000), adjustment(-200), adjustment(300)]);
		expect(got.toCents()).toBe(1_000 - 200 + 300);
	});

	it("a top-up reduces the net total; a set-aside increases it", () => {
		const base = sumNet([spend(1_000)]);
		const withTopup = sumNet([spend(1_000), adjustment(-200)]);
		const withSetaside = sumNet([spend(1_000), adjustment(200)]);
		expect(withTopup.toCents()).toBe(base.toCents() - 200);
		expect(withSetaside.toCents()).toBe(base.toCents() + 200);
	});

	it("a top-up and a set-aside of equal magnitude move the net in opposite directions", () => {
		const base = sumNet([spend(5_000)]).toCents();
		const topup = sumNet([spend(5_000), adjustment(-1_000)]).toCents();
		const setaside = sumNet([spend(5_000), adjustment(1_000)]).toCents();
		expect(base - topup).toBe(setaside - base);
		expect(topup).toBeLessThan(base);
		expect(setaside).toBeGreaterThan(base);
	});
});

describe("adjustmentAmountCents / adjustmentDirection", () => {
	it("maps top-up to a negative stored amount and set-aside to positive", () => {
		expect(adjustmentAmountCents("topup", 1_200)).toBe(-1_200);
		expect(adjustmentAmountCents("setaside", 1_200)).toBe(1_200);
	});

	it("recovers the direction from the stored sign", () => {
		expect(adjustmentDirection(-1_200)).toBe("topup");
		expect(adjustmentDirection(1_200)).toBe("setaside");
	});

	it("round-trips direction → stored amount → direction", () => {
		const directions: AdjustmentDirection[] = ["topup", "setaside"];
		for (const direction of directions) {
			const stored = adjustmentAmountCents(direction, 999);
			expect(adjustmentDirection(stored)).toBe(direction);
		}
	});

	it("rejects a non-positive or non-integer magnitude", () => {
		expect(() => adjustmentAmountCents("topup", 0)).toThrow();
		expect(() => adjustmentAmountCents("setaside", -100)).toThrow();
		expect(() => adjustmentAmountCents("topup", 12.5)).toThrow();
	});
});
