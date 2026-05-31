/**
 * Money — an integer-cent value object.
 *
 * Money is the only currency representation in the domain. The constructor
 * accepts integer cents; arithmetic returns new Money instances so the type
 * is immutable. Display formatting lives at the UI edge via `useFormat()`
 * (Module B); this class only knows arithmetic and the keypad's decimal format.
 *
 * Negative amounts are allowed (the daily-available number is allowed to go
 * negative and is not clamped — PRODUCT.md). Non-integer or non-finite
 * inputs throw, because rounding decisions belong at the boundary, not here.
 *
 * Removed from this class (Issue 01 — i18n refactor):
 *   - `format()` → use `useFormat().formatMoney(money.toCents())` in components
 *   - `fromEuroString()` → use `useFormat().parseAmount(input)` in components
 *   These were locale-specific (de-DE only) and belong at the UI edge.
 */

export class Money {
	private constructor(private readonly cents: number) {}

	static fromCents(cents: number): Money {
		if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
			throw new Error(`Money.fromCents requires integer cents, got ${cents}`);
		}
		return new Money(cents);
	}

	static zero(): Money {
		return new Money(0);
	}

	/**
	 * Parse the string a numeric keypad builds ("12", "12.5", "12.50",
	 * "0.99") into integer cents. This is locale-independent: the keypad
	 * only ever emits "." as its decimal separator.
	 *
	 * Rules:
	 *   - "" / "." → 0 (nothing meaningful typed)
	 *   - at most one decimal point; a second dot is rejected
	 *   - at most two fractional digits (cents); more is rejected
	 *   - only ASCII digits and a single dot; no sign, no comma, no spaces
	 *
	 * "12"   → 1200, "12.5" → 1250, "12.50" → 1250, "0.99" → 99,
	 * "100"  → 10000, "0.5" → 50, ".5" → 50.
	 */
	static fromDecimalString(input: string): Money {
		if (input === "" || input === ".") {
			return new Money(0);
		}
		if (!/^\d*\.?\d{0,2}$/.test(input)) {
			throw new Error(`Invalid keypad amount: ${input}`);
		}
		const [whole = "", frac = ""] = input.split(".");
		const paddedFrac = `${frac}00`.slice(0, 2);
		const wholeCents = whole === "" ? 0 : Number(whole) * 100;
		const totalCents = wholeCents + Number(paddedFrac);
		return new Money(totalCents);
	}

	add(other: Money): Money {
		return new Money(this.cents + other.cents);
	}

	subtract(other: Money): Money {
		return new Money(this.cents - other.cents);
	}

	/** Scale by an integer factor (e.g. elapsed days). */
	scaleInt(factor: number): Money {
		if (!Number.isInteger(factor)) {
			throw new Error(`scaleInt requires integer factor, got ${factor}`);
		}
		return new Money(this.cents * factor);
	}

	/**
	 * Divide by a positive integer divisor, rounding toward zero.
	 * Used for `(elapsed * monthly) / total_days`. Rounding direction matches
	 * what the user sees: cents we lose to the divide stay lost (the day's
	 * available is a conservative figure).
	 */
	divideIntFloor(divisor: number): Money {
		if (!Number.isInteger(divisor) || divisor <= 0) {
			throw new Error(
				`divideIntFloor requires positive integer, got ${divisor}`,
			);
		}
		// Truncation toward zero: identical to Math.trunc on the quotient.
		return new Money(Math.trunc(this.cents / divisor));
	}

	toCents(): number {
		return this.cents;
	}

	/**
	 * Render as the bare decimal string a `NumericKeypad` builds and edits
	 * ("12.50", "12", "0.99") — the inverse of `fromDecimalString`, used to
	 * pre-fill the keypad when editing an existing amount. Unsigned: the keypad
	 * holds a magnitude only, so the absolute value is rendered (callers pass a
	 * magnitude). Zero is the empty string ("nothing entered yet").
	 */
	toDecimalString(): string {
		const abs = Math.abs(this.cents);
		if (abs === 0) return "";
		const whole = Math.trunc(abs / 100);
		const frac = abs % 100;
		return frac === 0
			? `${whole}`
			: `${whole}.${String(frac).padStart(2, "0")}`;
	}

	isNegative(): boolean {
		return this.cents < 0;
	}

	equals(other: Money): boolean {
		return this.cents === other.cents;
	}
}
