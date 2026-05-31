/**
 * Module A — locale/currency resolver.
 *
 * Pure precedence logic — no I/O, no React, no Lingui runtime.
 * Precedence: userPref → cookie → Accept-Language → default.
 *
 * This slice (Issue 01) wires only cookie + Accept-Language + default.
 * userPref is threaded through but left as `null` placeholder until
 * Issue 02 adds the DB columns.
 */

import {
	DEFAULT_CURRENCY,
	DEFAULT_LOCALE,
	SUPPORTED_CURRENCIES,
	SUPPORTED_LOCALES,
	type SupportedCurrency,
	type SupportedLocale,
} from "#/i18n/config";

/** All inputs are optional strings (may be absent in a request). */
export interface ResolveInput {
	/** User's persisted preference from DB/session (Issue 02). */
	userLocale?: string | null;
	userCurrency?: string | null;
	/** Value of the locale cookie (e.g. "de"). */
	cookieLocale?: string | null;
	cookieCurrency?: string | null;
	/** Raw Accept-Language header (e.g. "de-DE,de;q=0.9,en;q=0.8"). */
	acceptLanguage?: string | null;
}

export interface ResolvedPrefs {
	locale: SupportedLocale;
	currency: SupportedCurrency;
}

/** Returns true when `v` is one of the supported locales. */
function isSupportedLocale(v: string): v is SupportedLocale {
	return (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

/** Returns true when `v` is one of the supported currencies. */
function isSupportedCurrency(v: string): v is SupportedCurrency {
	return (SUPPORTED_CURRENCIES as readonly string[]).includes(v);
}

/**
 * Parse the `Accept-Language` header and return the first supported locale.
 * E.g. "de-DE,de;q=0.9,en;q=0.8" → "de".
 * Returns `null` if no supported locale can be identified.
 */
export function parseAcceptLanguage(
	header: string | null | undefined,
): SupportedLocale | null {
	if (!header) return null;

	// Split by comma, strip q-values, get the raw tag.
	const tags = header
		.split(",")
		.map((part) => part.split(";")[0]?.trim() ?? "")
		.filter(Boolean);

	for (const tag of tags) {
		// Try exact match first ("de" or "en").
		if (isSupportedLocale(tag)) return tag;
		// Try the primary subtag ("de-DE" → "de", "en-US" → "en").
		const primary = tag.split("-")[0]?.toLowerCase() ?? "";
		if (isSupportedLocale(primary)) return primary;
	}
	return null;
}

/**
 * Resolve locale and currency from available signals.
 *
 * Precedence (highest → lowest):
 *   1. userLocale / userCurrency (DB preference — Issue 02 wires this)
 *   2. cookie
 *   3. Accept-Language (locale only; currency has no browser signal)
 *   4. default (en / EUR)
 */
export function resolvePrefs(input: ResolveInput): ResolvedPrefs {
	const locale = resolveLocale(input);
	const currency = resolveCurrency(input);
	return { locale, currency };
}

function resolveLocale(input: ResolveInput): SupportedLocale {
	// 1. User preference (persisted in DB).
	if (input.userLocale && isSupportedLocale(input.userLocale)) {
		return input.userLocale;
	}
	// 2. Cookie.
	if (input.cookieLocale && isSupportedLocale(input.cookieLocale)) {
		return input.cookieLocale;
	}
	// 3. Accept-Language header.
	const fromHeader = parseAcceptLanguage(input.acceptLanguage);
	if (fromHeader) return fromHeader;
	// 4. Default.
	return DEFAULT_LOCALE;
}

function resolveCurrency(input: ResolveInput): SupportedCurrency {
	// 1. User preference (persisted in DB).
	if (input.userCurrency && isSupportedCurrency(input.userCurrency)) {
		return input.userCurrency;
	}
	// 2. Cookie.
	if (input.cookieCurrency && isSupportedCurrency(input.cookieCurrency)) {
		return input.cookieCurrency;
	}
	// 3. No browser signal for currency.
	return DEFAULT_CURRENCY;
}
