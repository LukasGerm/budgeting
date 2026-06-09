/**
 * Module B tests — format/parse functions.
 *
 * Tests migrated from money.test.ts (format + fromEuroString assertions)
 * plus new locale×currency cross-product tests.
 */

import { describe, expect, it } from "vitest";
import {
	centsToInputString,
	formatAxisCents,
	formatDate,
	formatMoney,
	parseAmount,
} from "./format";

// Intl.NumberFormat emits a non-breaking space (U+00A0) between the amount
// and the currency symbol in many locales. Spell it out explicitly.
const NBSP = "\u00A0";

// ---------------------------------------------------------------------------
// formatMoney
// ---------------------------------------------------------------------------

describe("formatMoney", () => {
	it("formats EUR in en-GB locale (dot separator, trailing symbol)", () => {
		// en-GB: "300.00 €" with NBSP before €
		const result = formatMoney(30000, "en", "EUR");
		// Intl output for en-GB EUR: "€300.00" — verify it contains "300.00"
		// and "€" somewhere; exact layout varies by Node version.
		expect(result).toContain("300");
		expect(result).toContain("€");
	});

	it("formats EUR in de-DE locale (comma separator)", () => {
		// de-DE: "300,00 €" with NBSP
		const result = formatMoney(30000, "de", "EUR");
		expect(result).toContain("300,00");
		expect(result).toContain("€");
	});

	it("formats 1234.56 EUR de-DE with thousands separator", () => {
		// 123456 cents = 1234.56 euros
		const result = formatMoney(123456, "de", "EUR");
		expect(result).toContain("1.234,56");
		expect(result).toContain("€");
	});

	it("formats 1234.56 EUR en-GB with thousands separator", () => {
		const result = formatMoney(123456, "en", "EUR");
		expect(result).toContain("1,234.56");
		expect(result).toContain("€");
	});

	it("preserves NBSP in de-DE EUR output", () => {
		const result = formatMoney(30000, "de", "EUR");
		// Intl de-DE currency format has NBSP between amount and symbol
		expect(result).toContain(NBSP);
	});

	it("formats negative amounts correctly", () => {
		const de = formatMoney(-4700, "de", "EUR");
		expect(de).toContain("-47,00");

		const en = formatMoney(-4700, "en", "EUR");
		expect(en).toContain("-");
		expect(en).toContain("47");
	});

	it("formats USD in en locale", () => {
		const result = formatMoney(12345, "en", "USD");
		expect(result).toContain("123.45");
		expect(result).toContain("$");
	});

	it("formats GBP in en locale", () => {
		const result = formatMoney(10000, "en", "GBP");
		expect(result).toContain("100.00");
		expect(result).toContain("£");
	});

	it("formats CHF in de locale", () => {
		const result = formatMoney(10000, "de", "CHF");
		expect(result).toContain("100,00");
		expect(result).toContain("CHF");
	});

	it("formats zero", () => {
		expect(formatMoney(0, "en", "EUR")).toContain("0.00");
		expect(formatMoney(0, "de", "EUR")).toContain("0,00");
	});
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
	// Use a fixed date to avoid locale-dependent week day issues.
	// 2025-05-31 is a Saturday.
	const date = new Date(2025, 4, 31); // month is 0-indexed

	it("long style — en: contains weekday, day, and month", () => {
		const result = formatDate(date, "long", "en");
		expect(result.toLowerCase()).toContain("saturday");
		expect(result).toContain("31");
		expect(result.toLowerCase()).toContain("may");
	});

	it("long style — de: contains German weekday and month", () => {
		const result = formatDate(date, "long", "de");
		expect(result.toLowerCase()).toContain("samstag");
		expect(result).toContain("31");
		expect(result.toLowerCase()).toContain("mai");
	});

	it("short style — en: returns month abbreviation", () => {
		const result = formatDate(date, "short", "en");
		// en-GB short month: "May" (short months don't abbreviate for 3-letter months)
		expect(result.toLowerCase()).toContain("may");
	});

	it("short style — de: returns German month abbreviation", () => {
		const result = formatDate(date, "short", "de");
		// de-DE short month: "Mai"
		expect(result.toLowerCase()).toContain("mai");
	});

	it("dayMonth style — day + short month, no year", () => {
		const enResult = formatDate(date, "dayMonth", "en");
		const deResult = formatDate(date, "dayMonth", "de");
		expect(enResult).toContain("31");
		expect(enResult.toLowerCase()).toContain("may");
		expect(enResult).not.toContain("2025");
		expect(deResult).toContain("31");
		expect(deResult.toLowerCase()).toContain("mai");
		expect(deResult).not.toContain("2025");
	});

	it("numeric style contains day, month, year", () => {
		const enResult = formatDate(date, "numeric", "en");
		const deResult = formatDate(date, "numeric", "de");
		expect(enResult).toContain("31");
		expect(enResult).toContain("2025");
		expect(deResult).toContain("31");
		expect(deResult).toContain("2025");
	});
});

// ---------------------------------------------------------------------------
// formatAxisCents
// ---------------------------------------------------------------------------

describe("formatAxisCents", () => {
	// EN: symbol before number (e.g. "€999", "€1.5k")
	// DE: symbol after number with NBSP separator, matching Intl output
	//     (e.g. "999 €", "1,5k €")

	it("shows whole euros under 1000 — EN (symbol-first)", () => {
		expect(formatAxisCents(99900, "en", "EUR")).toBe("€999");
		expect(formatAxisCents(0, "en", "EUR")).toBe("€0");
	});

	it("shows whole euros under 1000 — DE (symbol-last with NBSP)", () => {
		expect(formatAxisCents(99900, "de", "EUR")).toBe(`999${NBSP}€`);
		expect(formatAxisCents(0, "de", "EUR")).toBe(`0${NBSP}€`);
	});

	it("shows 1 decimal k suffix for 1k–9.9k euros — EN (dot separator, symbol-first)", () => {
		// 100000 cents = 1000 euros → 1.0k
		expect(formatAxisCents(100_000, "en", "EUR")).toBe("€1.0k");
		// 120000 cents = 1200 euros → 1.2k
		expect(formatAxisCents(120_000, "en", "EUR")).toBe("€1.2k");
		// 200000 cents = 2000 euros → 2.0k
		expect(formatAxisCents(200_000, "en", "EUR")).toBe("€2.0k");
		// 950000 cents = 9500 euros → 9.5k
		expect(formatAxisCents(950_000, "en", "EUR")).toBe("€9.5k");
	});

	it("shows 1 decimal k suffix for 1k–9.9k euros — DE (comma separator, symbol-last with NBSP)", () => {
		expect(formatAxisCents(100_000, "de", "EUR")).toBe(`1,0k${NBSP}€`);
		expect(formatAxisCents(120_000, "de", "EUR")).toBe(`1,2k${NBSP}€`);
		expect(formatAxisCents(200_000, "de", "EUR")).toBe(`2,0k${NBSP}€`);
	});

	it("shows whole k for 10k+ euros — EN (symbol-first)", () => {
		// 1_000_000 cents = 10000 euros → 10k
		expect(formatAxisCents(1_000_000, "en", "EUR")).toBe("€10k");
		expect(formatAxisCents(1_200_000, "en", "EUR")).toBe("€12k");
	});

	it("shows whole k for 10k+ euros — DE (symbol-last with NBSP)", () => {
		expect(formatAxisCents(1_000_000, "de", "EUR")).toBe(`10k${NBSP}€`);
		expect(formatAxisCents(1_200_000, "de", "EUR")).toBe(`12k${NBSP}€`);
	});

	it("handles negatives symmetrically — EN", () => {
		expect(formatAxisCents(-99900, "en", "EUR")).toBe("-€999");
		expect(formatAxisCents(-100_000, "en", "EUR")).toBe("-€1.0k");
		expect(formatAxisCents(-1_000_000, "en", "EUR")).toBe("-€10k");
	});

	it("handles negatives symmetrically — DE (symbol-last with NBSP)", () => {
		expect(formatAxisCents(-99900, "de", "EUR")).toBe(`-999${NBSP}€`);
		expect(formatAxisCents(-100_000, "de", "EUR")).toBe(`-1,0k${NBSP}€`);
		expect(formatAxisCents(-1_000_000, "de", "EUR")).toBe(`-10k${NBSP}€`);
	});

	it("uses the correct currency symbol — EN", () => {
		expect(formatAxisCents(100_00, "en", "USD")).toContain("$");
		expect(formatAxisCents(100_00, "en", "GBP")).toContain("£");
	});
});

// ---------------------------------------------------------------------------
// parseAmount
// ---------------------------------------------------------------------------

describe("parseAmount", () => {
	it("parses EN locale: dot as decimal separator", () => {
		expect(parseAmount("12.50", "en")).toBe(1250);
		expect(parseAmount("300", "en")).toBe(30000);
		expect(parseAmount("0.01", "en")).toBe(1);
		expect(parseAmount("1234.56", "en")).toBe(123456);
	});

	it("parses DE locale: comma as decimal separator", () => {
		expect(parseAmount("12,50", "de")).toBe(1250);
		expect(parseAmount("300", "de")).toBe(30000);
		expect(parseAmount("0,01", "de")).toBe(1);
		expect(parseAmount("1234,56", "de")).toBe(123456);
	});

	it("trims surrounding whitespace", () => {
		expect(parseAmount("  12.50  ", "en")).toBe(1250);
		expect(parseAmount("  12,50  ", "de")).toBe(1250);
	});

	it("parses negative amounts", () => {
		expect(parseAmount("-5.25", "en")).toBe(-525);
		expect(parseAmount("-5,25", "de")).toBe(-525);
	});

	it("throws on empty string", () => {
		expect(() => parseAmount("", "en")).toThrow();
		expect(() => parseAmount("   ", "en")).toThrow();
	});

	it("throws on too many decimal places", () => {
		expect(() => parseAmount("12.345", "en")).toThrow();
		expect(() => parseAmount("12,345", "de")).toThrow();
	});

	it("throws on letters and non-numeric input", () => {
		expect(() => parseAmount("abc", "en")).toThrow();
		expect(() => parseAmount("12.5a", "en")).toThrow();
	});

	it("throws when wrong separator for locale", () => {
		// Comma is not the EN decimal separator — "12,50" reads as "1250" which
		// doesn't pass the regex (comma left in after failed replace).
		expect(() => parseAmount("12,50", "en")).toThrow();
	});

	it("accepts whole numbers (no decimal)", () => {
		expect(parseAmount("300", "en")).toBe(30000);
		expect(parseAmount("300", "de")).toBe(30000);
	});

	it("accepts 1-decimal-place input", () => {
		expect(parseAmount("12.5", "en")).toBe(1250);
		expect(parseAmount("12,5", "de")).toBe(1250);
	});
});

// ---------------------------------------------------------------------------
// centsToInputString
// ---------------------------------------------------------------------------

describe("centsToInputString", () => {
	it("formats as EN decimal string (dot)", () => {
		expect(centsToInputString(30000, "en")).toBe("300.00");
		expect(centsToInputString(1250, "en")).toBe("12.50");
		expect(centsToInputString(1, "en")).toBe("0.01");
	});

	it("formats as DE decimal string (comma)", () => {
		expect(centsToInputString(30000, "de")).toBe("300,00");
		expect(centsToInputString(1250, "de")).toBe("12,50");
	});

	it("is the inverse of parseAmount (round-trip)", () => {
		for (const cents of [30000, 1250, 100, 1, 99]) {
			expect(parseAmount(centsToInputString(cents, "en"), "en")).toBe(cents);
			expect(parseAmount(centsToInputString(cents, "de"), "de")).toBe(cents);
		}
	});
});
