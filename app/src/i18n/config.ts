/**
 * Module D — static locale and currency configuration.
 *
 * Data only: supported locale list and the curated 2-decimal currency set.
 * No functions, no imports — safe to use anywhere (server, client, tests).
 */

export const SUPPORTED_LOCALES = ["en", "de"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const DEFAULT_CURRENCY: SupportedCurrency = "EUR";

/** The cookie name for the resolved locale. Both server and client read this. */
export const LOCALE_COOKIE = "locale";
/** The cookie name for the resolved currency. Both server and client read this. */
export const CURRENCY_COOKIE = "currency";
