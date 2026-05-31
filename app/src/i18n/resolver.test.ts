/**
 * Module A tests — locale/currency resolver precedence chain.
 */

import { describe, expect, it } from "vitest";
import { parseAcceptLanguage, resolvePrefs } from "./resolver";

describe("parseAcceptLanguage", () => {
	it("returns null for null/undefined/empty input", () => {
		expect(parseAcceptLanguage(null)).toBeNull();
		expect(parseAcceptLanguage(undefined)).toBeNull();
		expect(parseAcceptLanguage("")).toBeNull();
	});

	it("matches exact supported locale", () => {
		expect(parseAcceptLanguage("de")).toBe("de");
		expect(parseAcceptLanguage("en")).toBe("en");
	});

	it("extracts primary subtag from locale tag", () => {
		expect(parseAcceptLanguage("de-DE")).toBe("de");
		expect(parseAcceptLanguage("en-US")).toBe("en");
		expect(parseAcceptLanguage("de-AT")).toBe("de");
		expect(parseAcceptLanguage("en-GB")).toBe("en");
	});

	it("picks first supported locale from q-value list", () => {
		expect(parseAcceptLanguage("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
		expect(parseAcceptLanguage("en-US,en;q=0.9,de;q=0.8")).toBe("en");
	});

	it("falls back to next locale when first is unsupported", () => {
		expect(parseAcceptLanguage("fr-FR,fr;q=0.9,de;q=0.8,en;q=0.7")).toBe("de");
	});

	it("returns null when no supported locale found", () => {
		expect(parseAcceptLanguage("fr-FR,fr;q=0.9")).toBeNull();
		expect(parseAcceptLanguage("zh-CN")).toBeNull();
	});
});

describe("resolvePrefs — locale precedence", () => {
	it("defaults to en/EUR when nothing is provided", () => {
		expect(resolvePrefs({})).toEqual({ locale: "en", currency: "EUR" });
	});

	it("returns en/EUR for empty strings", () => {
		expect(resolvePrefs({ cookieLocale: "", cookieCurrency: "" })).toEqual({
			locale: "en",
			currency: "EUR",
		});
	});

	it("uses cookie locale over Accept-Language", () => {
		expect(
			resolvePrefs({
				cookieLocale: "de",
				acceptLanguage: "en-US,en;q=0.9",
			}).locale,
		).toBe("de");
	});

	it("uses Accept-Language when no cookie", () => {
		expect(
			resolvePrefs({ acceptLanguage: "de-DE,de;q=0.9,en;q=0.8" }).locale,
		).toBe("de");
	});

	it("ignores unsupported Accept-Language and falls back to default", () => {
		expect(resolvePrefs({ acceptLanguage: "fr-FR,fr;q=0.9" }).locale).toBe(
			"en",
		);
	});

	it("ignores unsupported cookie locale and falls back", () => {
		expect(
			resolvePrefs({ cookieLocale: "fr", acceptLanguage: "de" }).locale,
		).toBe("de");
	});

	it("userLocale takes precedence over cookie", () => {
		expect(
			resolvePrefs({
				userLocale: "de",
				cookieLocale: "en",
				acceptLanguage: "en-US",
			}).locale,
		).toBe("de");
	});

	it("userLocale takes precedence over Accept-Language", () => {
		expect(
			resolvePrefs({ userLocale: "de", acceptLanguage: "en" }).locale,
		).toBe("de");
	});

	it("ignores unsupported userLocale and falls back to cookie", () => {
		expect(resolvePrefs({ userLocale: "fr", cookieLocale: "de" }).locale).toBe(
			"de",
		);
	});
});

describe("resolvePrefs — currency precedence", () => {
	it("defaults to EUR", () => {
		expect(resolvePrefs({}).currency).toBe("EUR");
	});

	it("uses cookie currency", () => {
		expect(resolvePrefs({ cookieCurrency: "USD" }).currency).toBe("USD");
	});

	it("ignores unsupported cookie currency", () => {
		expect(resolvePrefs({ cookieCurrency: "JPY" }).currency).toBe("EUR");
	});

	it("userCurrency takes precedence over cookie", () => {
		expect(
			resolvePrefs({ userCurrency: "GBP", cookieCurrency: "USD" }).currency,
		).toBe("GBP");
	});

	it("supports all four currencies", () => {
		expect(resolvePrefs({ cookieCurrency: "EUR" }).currency).toBe("EUR");
		expect(resolvePrefs({ cookieCurrency: "USD" }).currency).toBe("USD");
		expect(resolvePrefs({ cookieCurrency: "GBP" }).currency).toBe("GBP");
		expect(resolvePrefs({ cookieCurrency: "CHF" }).currency).toBe("CHF");
	});
});
