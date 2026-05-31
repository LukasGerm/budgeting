import { describe, expect, it } from "vitest";
import { Money } from "./money";

describe("Money", () => {
	it("constructs from integer cents", () => {
		expect(Money.fromCents(1234).toCents()).toBe(1234);
		expect(Money.zero().toCents()).toBe(0);
	});

	it("rejects non-integer cents", () => {
		expect(() => Money.fromCents(1.5)).toThrow();
		expect(() => Money.fromCents(Number.NaN)).toThrow();
		expect(() => Money.fromCents(Number.POSITIVE_INFINITY)).toThrow();
	});

	it("parses keypad decimal strings into cents", () => {
		expect(Money.fromDecimalString("12").toCents()).toBe(1200);
		expect(Money.fromDecimalString("12.5").toCents()).toBe(1250);
		expect(Money.fromDecimalString("12.50").toCents()).toBe(1250);
		expect(Money.fromDecimalString("0.99").toCents()).toBe(99);
		expect(Money.fromDecimalString("100").toCents()).toBe(10000);
		expect(Money.fromDecimalString("0.5").toCents()).toBe(50);
		expect(Money.fromDecimalString(".5").toCents()).toBe(50);
		expect(Money.fromDecimalString("0").toCents()).toBe(0);
	});

	it("treats an empty or dot-only keypad string as zero", () => {
		expect(Money.fromDecimalString("").toCents()).toBe(0);
		expect(Money.fromDecimalString(".").toCents()).toBe(0);
	});

	it("rejects malformed keypad strings", () => {
		// Multiple dots.
		expect(() => Money.fromDecimalString("1.2.3")).toThrow();
		expect(() => Money.fromDecimalString("..")).toThrow();
		// More than two fractional digits.
		expect(() => Money.fromDecimalString("12.345")).toThrow();
		// Comma is not accepted here (keypad only emits ".").
		expect(() => Money.fromDecimalString("12,50")).toThrow();
		// No signs or stray characters.
		expect(() => Money.fromDecimalString("-5")).toThrow();
		expect(() => Money.fromDecimalString("1a")).toThrow();
	});

	it("adds and subtracts without float drift", () => {
		// Classic floating-point trap: 0.1 + 0.2 !== 0.3.
		// In integer cents, the same sum is exact.
		let sum = Money.zero();
		for (let i = 0; i < 1000; i++) {
			sum = sum.add(Money.fromCents(1)); // 0,01 € a thousand times
		}
		expect(sum.toCents()).toBe(1000);
	});

	it("survives a long sequence of mixed adds and subtracts", () => {
		let running = Money.zero();
		for (let i = 0; i < 10_000; i++) {
			running = running.add(Money.fromCents(7)).subtract(Money.fromCents(3));
		}
		// (+7 -3) × 10 000 = +40 000 cents = 400,00 €
		expect(running.toCents()).toBe(40_000);
	});

	it("scales by integer factors", () => {
		expect(Money.fromCents(100).scaleInt(7).toCents()).toBe(700);
		expect(Money.fromCents(123).scaleInt(0).toCents()).toBe(0);
		expect(() => Money.fromCents(100).scaleInt(1.5)).toThrow();
	});

	it("divides by positive integer with truncation toward zero", () => {
		expect(Money.fromCents(1000).divideIntFloor(3).toCents()).toBe(333);
		expect(Money.fromCents(-1000).divideIntFloor(3).toCents()).toBe(-333);
		expect(() => Money.fromCents(100).divideIntFloor(0)).toThrow();
		expect(() => Money.fromCents(100).divideIntFloor(-2)).toThrow();
	});

	it("detects negatives and equality", () => {
		expect(Money.fromCents(-1).isNegative()).toBe(true);
		expect(Money.fromCents(0).isNegative()).toBe(false);
		expect(Money.fromCents(50).equals(Money.fromCents(50))).toBe(true);
		expect(Money.fromCents(50).equals(Money.fromCents(51))).toBe(false);
	});

	it("renders unsigned decimal string for keypad prefill", () => {
		expect(Money.fromCents(30000).toDecimalString()).toBe("300");
		expect(Money.fromCents(1250).toDecimalString()).toBe("12.50");
		expect(Money.fromCents(1419).toDecimalString()).toBe("14.19");
		// Zero → empty string ("nothing entered yet")
		expect(Money.fromCents(0).toDecimalString()).toBe("");
		expect(Money.zero().toDecimalString()).toBe("");
	});
});
