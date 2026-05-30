/**
 * Entry — the kind discriminator and the SINGLE source of truth for the
 * adjustment sign convention.
 *
 * An `Expense` row is the ledger entry. It is either a normal **spend** or a
 * one-off **adjustment** (a top-up or a set-aside). To keep the available-today
 * math sign-agnostic, adjustments are stored on the *spent side* of the
 * formula:
 *
 *   - spend                 → `amountCents > 0`   (charged against the budget)
 *   - adjustment set-aside  → `amountCents > 0`   (adds to spent → LOWERS available)
 *   - adjustment top-up     → `amountCents < 0`   (a "negative spend" → RAISES available)
 *
 * Then `spent = Σ amountCents over all in-cycle entries`, and
 * `available = earned − spent`, `monthlyRemaining = monthly − spent`. Because
 * the math only ever sums signed amounts, a top-up raises the numbers by its
 * full magnitude and a set-aside lowers them by its full magnitude — both
 * immediately, with no spreading across the cycle.
 *
 * The direction↔sign mapping lives ONLY here (`adjustmentAmountCents` /
 * `adjustmentDirection`). Nothing else in the codebase should special-case the
 * sign of an adjustment.
 */

import { Money } from "./money";
import type { Expense } from "./types";

/** What a ledger entry is. */
export type EntryKind = "spend" | "adjustment";

/** Which way a one-off adjustment moves the available number. */
export type AdjustmentDirection = "topup" | "setaside";

/**
 * Map a user-facing adjustment direction + a positive magnitude to the *stored*
 * signed `amountCents`. This is the only place the convention is encoded:
 *   - top-up   → negative stored amount (raises available)
 *   - set-aside → positive stored amount (lowers available)
 *
 * `magnitudeCents` must be a positive integer (the keypad always yields an
 * unsigned magnitude); anything else is a programmer error and throws.
 */
export function adjustmentAmountCents(
	direction: AdjustmentDirection,
	magnitudeCents: number,
): number {
	if (!Number.isInteger(magnitudeCents) || magnitudeCents <= 0) {
		throw new Error(
			`adjustmentAmountCents requires a positive integer magnitude, got ${magnitudeCents}`,
		);
	}
	return direction === "topup" ? -magnitudeCents : magnitudeCents;
}

/**
 * Inverse of {@link adjustmentAmountCents}: recover the direction from a stored
 * signed amount, for display. A negative amount is a top-up; zero or positive is
 * a set-aside (a zero-amount adjustment is rejected upstream, so it never
 * reaches here in practice).
 */
export function adjustmentDirection(amountCents: number): AdjustmentDirection {
	return amountCents < 0 ? "topup" : "setaside";
}

/**
 * Sum of `amount` over entries that are **spends only** — adjustments (both
 * top-ups and set-asides) are excluded. Used where "money actually spent"
 * matters independently of one-off budget tweaks (e.g. the streak engine).
 */
export function sumSpends(entries: readonly Expense[]): Money {
	let sum = Money.zero();
	for (const e of entries) {
		if (e.kind === "spend") sum = sum.add(e.amount);
	}
	return sum;
}

/**
 * Sum of `amount` over **all** entries (spends + signed adjustments) — the
 * total charged against the budget. A top-up (stored negative) reduces this
 * net total; a set-aside (stored positive) increases it. This is what the
 * available-today / monthly-remaining math subtracts.
 */
export function sumNet(entries: readonly Expense[]): Money {
	let sum = Money.zero();
	for (const e of entries) {
		sum = sum.add(e.amount);
	}
	return sum;
}
