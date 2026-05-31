/**
 * Module B — pure format/parse functions.
 *
 * These are locale-aware but framework-agnostic: no React, no context.
 * Each function accepts explicit `locale` and `currency` parameters.
 * The `useFormat()` hook wraps these, filling in locale/currency from context.
 *
 * Key design decisions:
 * - `formatMoney` uses `Intl.NumberFormat` with currency style, preserving the
 *   NBSP (U+00A0) that Intl emits between amount and symbol.
 * - `parseAmount` accepts locale-aware decimal input (comma for DE, dot for EN).
 *   It validates strictly: empty string → throws, too many decimals → throws.
 * - `formatAxisCents` is the compact Y-axis formatter, locale-aware for the
 *   decimal separator (DE uses comma, EN uses dot).
 */

import type { SupportedCurrency, SupportedLocale } from "#/i18n/config";

// ---------------------------------------------------------------------------
// Money formatting
// ---------------------------------------------------------------------------

/**
 * Format integer cents as a currency string using the given locale and currency.
 * E.g. en/USD: "1,234.56 $" → but with NBSP between amount and symbol as Intl emits.
 */
export function formatMoney(
	cents: number,
	locale: SupportedLocale,
	currency: SupportedCurrency,
): string {
	return new Intl.NumberFormat(localeToIntl(locale), {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

export type DateFormatStyle = "long" | "short" | "numeric";

/**
 * Format a date according to the active locale.
 *
 * Styles:
 *   "long"    → weekday + day + month (e.g. "Saturday, 31 May" / "Samstag, 31. Mai")
 *   "short"   → short month abbrev (e.g. "May" / "Mai")
 *   "numeric" → day/month/year numerics (e.g. "31/05/2025" / "31.05.2025")
 */
export function formatDate(
	date: Date,
	style: DateFormatStyle,
	locale: SupportedLocale,
): string {
	const intlLocale = localeToIntl(locale);
	switch (style) {
		case "long":
			return new Intl.DateTimeFormat(intlLocale, {
				weekday: "long",
				day: "numeric",
				month: "long",
			}).format(date);
		case "short":
			return new Intl.DateTimeFormat(intlLocale, {
				month: "short",
			}).format(date);
		case "numeric":
			return new Intl.DateTimeFormat(intlLocale, {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			}).format(date);
	}
}

// ---------------------------------------------------------------------------
// Compact Y-axis formatter
// ---------------------------------------------------------------------------

/**
 * Compact Y-axis tick label for integer-cent values, locale-aware decimal
 * separator AND symbol position.
 *
 * Rules:
 *   |cents| <  100_000  (< 1 000 units) → N / symbol+N or N+symbol depending on locale
 *   |cents| < 1_000_000 (< 10 000 units) → N.Dk / N,Dk  e.g. "€1.2k" / "1,2k €"
 *   |cents| ≥ 1_000_000 (≥ 10 000 units) → Nk           e.g. "€12k"  / "12k €"
 *
 * Symbol position follows the locale: EN → before ("€1.5k"), DE → after ("1,5k €").
 * The spacing between the number and a trailing symbol mirrors the non-breaking
 * space (U+00A0) that Intl emits in the same locale.
 *
 * Negatives are handled symmetrically with a leading "-" before everything.
 */
export function formatAxisCents(
	cents: number,
	locale: SupportedLocale,
	currency: SupportedCurrency,
): string {
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(cents);
	const euros = Math.trunc(abs / 100);
	const { symbol, symbolFirst, symbolGap } = getCurrencySymbolInfo(
		locale,
		currency,
	);
	const decimalSep = getDecimalSeparator(locale);

	function assemble(number: string): string {
		if (symbolFirst) {
			return `${sign}${symbol}${number}`;
		}
		return `${sign}${number}${symbolGap}${symbol}`;
	}

	if (abs < 100_000) {
		return assemble(String(euros));
	}

	const thousands = abs / 100_000;
	if (abs < 1_000_000) {
		const formatted = thousands.toFixed(1).replace(".", decimalSep);
		return assemble(`${formatted}k`);
	}

	const wholeThousands = Math.trunc(abs / 100_000);
	return assemble(`${wholeThousands}k`);
}

// ---------------------------------------------------------------------------
// Amount parsing (locale-aware, used in settings/onboarding text inputs)
// ---------------------------------------------------------------------------

/**
 * Parse a locale-aware decimal amount string to integer cents.
 *
 * - EN locale: expects dot as decimal separator ("300.50", "12.5", "300")
 * - DE locale: expects comma as decimal separator ("300,50", "12,5", "300")
 * - Negatives are supported ("-5.25" / "-5,25")
 * - Whitespace is trimmed
 * - Empty string throws
 * - More than 2 fractional digits throws
 * - Both "300" and "300.00" / "300,00" are valid
 */
export function parseAmount(input: string, locale: SupportedLocale): number {
	const trimmed = input.trim();
	if (trimmed === "") {
		throw new Error("Amount cannot be empty");
	}

	// Normalise to dot-decimal: replace the locale's decimal separator with ".".
	const decimalSep = getDecimalSeparator(locale);
	const normalised = trimmed.replace(decimalSep, ".");

	// Validate: optional sign, digits, optional dot + up to 2 fractional digits.
	if (!/^-?\d+(\.\d{1,2})?$/.test(normalised)) {
		throw new Error(`Invalid amount: ${input}`);
	}

	const [whole, frac = ""] = normalised.split(".");
	const paddedFrac = `${frac}00`.slice(0, 2);
	const sign = whole.startsWith("-") ? -1 : 1;
	const wholeAbs = whole.replace("-", "");
	return sign * (Number(wholeAbs) * 100 + Number(paddedFrac));
}

// ---------------------------------------------------------------------------
// Pre-fill helpers: format cents back to a locale-aware input string
// ---------------------------------------------------------------------------

/**
 * Format integer cents as a locale-aware decimal string suitable for a text
 * input (the inverse of `parseAmount`).
 *
 * Used to pre-fill the settings/onboarding budget input from the stored cents.
 */
export function centsToInputString(
	cents: number,
	locale: SupportedLocale,
): string {
	const abs = Math.abs(cents);
	const whole = Math.trunc(abs / 100);
	const frac = abs % 100;
	const decimalSep = getDecimalSeparator(locale);
	const sign = cents < 0 ? "-" : "";
	return `${sign}${whole}${decimalSep}${String(frac).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a SupportedLocale to the Intl locale string. */
function localeToIntl(locale: SupportedLocale): string {
	switch (locale) {
		case "en":
			return "en-GB";
		case "de":
			return "de-DE";
	}
}

/** The decimal separator for the locale (comma for DE, dot for EN). */
export function getDecimalSeparator(locale: SupportedLocale): string {
	return locale === "de" ? "," : ".";
}

interface CurrencySymbolInfo {
	/** The narrow currency symbol, e.g. "€", "$", "£". */
	symbol: string;
	/** Whether the symbol appears before the numeric part (true for EN, false for DE). */
	symbolFirst: boolean;
	/**
	 * The literal separator between the number and a trailing symbol (e.g. NBSP
	 * for de-DE EUR). Empty string when there is no gap or the symbol is leading.
	 */
	symbolGap: string;
}

/**
 * Derive the narrow currency symbol and its locale-aware position by inspecting
 * the parts order from `Intl.NumberFormat.formatToParts`. The `currency` part
 * coming before the `integer` part → symbol-first (EN); after → symbol-last (DE).
 * A `literal` part adjacent to the symbol in the trailing position → gap needed.
 */
function getCurrencySymbolInfo(
	locale: SupportedLocale,
	currency: SupportedCurrency,
): CurrencySymbolInfo {
	const fmt = new Intl.NumberFormat(localeToIntl(locale), {
		style: "currency",
		currency,
		currencyDisplay: "narrowSymbol",
	});
	// Format a positive non-zero value so the sign part is absent.
	const parts = fmt.formatToParts(1);

	const currencyIdx = parts.findIndex((p) => p.type === "currency");
	const integerIdx = parts.findIndex((p) => p.type === "integer");
	const symbol = parts[currencyIdx]?.value ?? currency;
	const symbolFirst = currencyIdx < integerIdx;

	// If a literal part immediately precedes the trailing currency symbol,
	// capture it so we can reproduce the exact separator in compact labels.
	let symbolGap = "";
	if (!symbolFirst && currencyIdx > 0) {
		const preceding = parts[currencyIdx - 1];
		if (preceding?.type === "literal") {
			symbolGap = preceding.value;
		}
	}

	return { symbol, symbolFirst, symbolGap };
}
