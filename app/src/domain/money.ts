/**
 * Money — an integer-cent value object.
 *
 * Money is the only currency representation in the domain. The constructor
 * accepts integer cents; arithmetic returns new Money instances so the type
 * is immutable. Formatting to a decimal string happens at the UI edge via
 * `format()`. The DB, the wire, and the domain all speak cents — only the
 * pixels see euros.
 *
 * Negative amounts are allowed (the daily-available number is allowed to go
 * negative and is not clamped — PRODUCT.md). Non-integer or non-finite
 * inputs throw, because rounding decisions belong at the boundary, not here.
 */

const EUR_FORMATTER = new Intl.NumberFormat("de-DE", {
	style: "currency",
	currency: "EUR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

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
	 * Parse a decimal EUR string ("12,50" or "12.50") from a form input.
	 * Used only at the UI edge. Throws if not a valid amount.
	 */
	static fromEuroString(input: string): Money {
		const normalised = input.trim().replace(",", ".");
		if (!/^-?\d+(\.\d{1,2})?$/.test(normalised)) {
			throw new Error(`Invalid euro amount: ${input}`);
		}
		const [whole, frac = ""] = normalised.split(".");
		const paddedFrac = `${frac}00`.slice(0, 2);
		const sign = whole.startsWith("-") ? -1 : 1;
		const wholeAbs = whole.replace("-", "");
		const totalCents = sign * (Number(wholeAbs) * 100 + Number(paddedFrac));
		return new Money(totalCents);
	}

	/**
	 * Parse the string a numeric keypad builds ("12", "12.5", "12.50",
	 * "0.99") into integer cents. This is the keypad's counterpart to
	 * `fromEuroString`: it accepts a partially-typed amount, so an empty or
	 * dot-only string is "nothing entered yet" → 0 cents rather than an error.
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

	isNegative(): boolean {
		return this.cents < 0;
	}

	equals(other: Money): boolean {
		return this.cents === other.cents;
	}

	/**
	 * Format as a localised EUR string for display. The only place the domain
	 * speaks to the UI — keep this thin.
	 */
	format(): string {
		return EUR_FORMATTER.format(this.cents / 100);
	}
}
