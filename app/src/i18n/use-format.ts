/**
 * useFormat — React hook that exposes locale-aware format/parse functions.
 *
 * Reads `{ locale, currency }` from LocaleContext and returns bound versions
 * of the pure Module B functions so components don't need to thread locale/currency
 * manually.
 *
 * Call useFormat() once at the top of a component, then pass the returned
 * functions into Recharts formatters or anywhere else — do NOT call hooks
 * inside callbacks.
 */

import {
	centsToInputString,
	type DateFormatStyle,
	formatAxisCents,
	formatDate,
	formatMoney,
	parseAmount,
} from "#/i18n/format";
import { useLocaleContext } from "#/i18n/locale-context";

export interface FormatFns {
	/** Format integer cents as a currency string (uses locale + currency from context). */
	formatMoney: (cents: number) => string;
	/** Format a Date for display. */
	formatDate: (date: Date, style: DateFormatStyle) => string;
	/** Compact Y-axis tick label for integer-cent values. */
	formatAxisCents: (cents: number) => string;
	/**
	 * Parse a locale-aware decimal string to integer cents.
	 * Throws on invalid input (empty, bad format, too many decimals).
	 */
	parseAmount: (input: string) => number;
	/**
	 * Format integer cents as a locale-aware decimal string suitable for a text
	 * input (the inverse of parseAmount). Used to pre-fill settings inputs.
	 */
	centsToInputString: (cents: number) => string;
}

export function useFormat(): FormatFns {
	const { locale, currency } = useLocaleContext();

	return {
		formatMoney: (cents) => formatMoney(cents, locale, currency),
		formatDate: (date, style) => formatDate(date, style, locale),
		formatAxisCents: (cents) => formatAxisCents(cents, locale, currency),
		parseAmount: (input) => parseAmount(input, locale),
		centsToInputString: (cents) => centsToInputString(cents, locale),
	};
}
