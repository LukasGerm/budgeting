/**
 * Unit tests for Module H: useErrorMessage + errorCodeFromTRPC +
 * errorCodeFromBetterAuth.
 *
 * Strategy:
 * - `useErrorMessage` is tested via renderWithI18n so we cover both locales
 *   and assert the translated output (not the hook internals).
 * - `errorCodeFromTRPC` and `errorCodeFromBetterAuth` are pure helpers; tested
 *   directly without a render.
 *
 * @vitest-environment jsdom
 */

import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { SupportedCurrency, SupportedLocale } from "#/i18n/config";
import { LocaleContext } from "#/i18n/locale-context";
import {
	errorCodeFromBetterAuth,
	errorCodeFromTRPC,
	useErrorMessage,
} from "#/i18n/use-error-message";
import { messages as deMessages } from "#/locales/de/messages";
import { messages as enMessages } from "#/locales/en/messages";

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Helpers for renderHook with i18n wrapper
// ---------------------------------------------------------------------------

function makeWrapper(locale: SupportedLocale, currency: SupportedCurrency) {
	const i18n = setupI18n();
	i18n.load({ en: enMessages, de: deMessages });
	i18n.activate(locale);

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<I18nProvider i18n={i18n}>
				<LocaleContext.Provider
					value={{ locale, currency, setPreferences: () => {} }}
				>
					{children}
				</LocaleContext.Provider>
			</I18nProvider>
		);
	};
}

// ---------------------------------------------------------------------------
// useErrorMessage — known codes → correct EN and DE messages
// ---------------------------------------------------------------------------

describe("useErrorMessage — EN locale", () => {
	const wrapper = makeWrapper("en", "EUR");

	it("maps SPEND_NOT_POSITIVE to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("SPEND_NOT_POSITIVE")).toBe(
			"A spend amount must be positive.",
		);
	});

	it("maps ADJUSTMENT_ZERO to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("ADJUSTMENT_ZERO")).toBe(
			"An adjustment amount must be non-zero.",
		);
	});

	it("maps AMOUNT_ZERO to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("AMOUNT_ZERO")).toBe("Amount must be non-zero.");
	});

	it("maps BUDGET_NOT_POSITIVE to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("BUDGET_NOT_POSITIVE")).toBe(
			"Budget must be greater than zero.",
		);
	});

	it("maps ANCHOR_OUT_OF_RANGE to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("ANCHOR_OUT_OF_RANGE")).toBe(
			"Anchor day must be between 1 and 31.",
		);
	});

	it("maps INVALID_AMOUNT to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("INVALID_AMOUNT")).toBe(
			"Enter a valid amount (e.g. 300 or 1234.50).",
		);
	});

	it("maps HABIT_NAME_REQUIRED to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("HABIT_NAME_REQUIRED")).toBe(
			"Habit name can't be empty.",
		);
	});

	it("maps HABIT_NAME_TOO_LONG to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("HABIT_NAME_TOO_LONG")).toBe(
			"Habit name must be 60 characters or fewer.",
		);
	});

	it("maps NOTE_TOO_LONG to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("NOTE_TOO_LONG")).toBe(
			"Note must be 280 characters or fewer.",
		);
	});

	it("maps INVALID_CREDENTIALS to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("INVALID_CREDENTIALS")).toBe(
			"Invalid email or password.",
		);
	});

	it("maps EMAIL_TAKEN to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("EMAIL_TAKEN")).toBe(
			"An account with this email already exists.",
		);
	});

	it("maps WEAK_PASSWORD to an EN message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("WEAK_PASSWORD")).toBe(
			"Password must be at least 8 characters.",
		);
	});

	it("maps SAVE_FAILED to the generic EN fallback", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("SAVE_FAILED")).toBe(
			"Something went wrong. Check your connection and try again.",
		);
	});

	it("maps UNKNOWN to the generic EN fallback", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("UNKNOWN")).toBe(
			"Something went wrong. Check your connection and try again.",
		);
	});
});

describe("useErrorMessage — DE locale", () => {
	const wrapper = makeWrapper("de", "EUR");

	it("maps SPEND_NOT_POSITIVE to a DE message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("SPEND_NOT_POSITIVE")).toBe(
			"Ein Ausgabebetrag muss positiv sein.",
		);
	});

	it("maps INVALID_CREDENTIALS to a DE message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("INVALID_CREDENTIALS")).toBe(
			"E-Mail-Adresse oder Passwort ist ungültig.",
		);
	});

	it("maps EMAIL_TAKEN to a DE message", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("EMAIL_TAKEN")).toBe(
			"Ein Konto mit dieser E-Mail-Adresse existiert bereits.",
		);
	});

	it("maps SAVE_FAILED to the generic DE fallback", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		expect(result.current("SAVE_FAILED")).toBe(
			"Etwas ist schiefgelaufen. Überprüfe deine Verbindung und versuche es erneut.",
		);
	});
});

describe("useErrorMessage — unknown / null / undefined codes fall back gracefully", () => {
	const wrapper = makeWrapper("en", "EUR");

	it("maps null to the generic fallback (not blank, not the raw code)", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		const msg = result.current(null);
		expect(msg).toBeTruthy();
		expect(msg).not.toBe("null");
		expect(msg).toBe(
			"Something went wrong. Check your connection and try again.",
		);
	});

	it("maps undefined to the generic fallback", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		const msg = result.current(undefined);
		expect(msg).toBeTruthy();
		expect(msg).not.toBe("undefined");
	});

	it("maps an arbitrary unknown string to the generic fallback (not blank, not the raw code)", () => {
		const { result } = renderHook(() => useErrorMessage(), { wrapper });
		const msg = result.current("TOTALLY_UNKNOWN_CODE");
		expect(msg).toBeTruthy();
		expect(msg).not.toBe("TOTALLY_UNKNOWN_CODE");
		expect(msg).toBe(
			"Something went wrong. Check your connection and try again.",
		);
	});
});

// ---------------------------------------------------------------------------
// errorCodeFromTRPC
// ---------------------------------------------------------------------------

describe("errorCodeFromTRPC", () => {
	it("returns the appErrorCode when it is a known code", () => {
		const err = { data: { appErrorCode: "SPEND_NOT_POSITIVE" } };
		expect(errorCodeFromTRPC(err)).toBe("SPEND_NOT_POSITIVE");
	});

	it("returns null when appErrorCode is an unknown string", () => {
		const err = { data: { appErrorCode: "NOT_A_REAL_CODE" } };
		expect(errorCodeFromTRPC(err)).toBeNull();
	});

	it("returns null when appErrorCode is missing", () => {
		const err = { data: {} };
		expect(errorCodeFromTRPC(err)).toBeNull();
	});

	it("returns null when data is missing", () => {
		const err = {};
		expect(errorCodeFromTRPC(err)).toBeNull();
	});

	it("returns null for null input", () => {
		expect(errorCodeFromTRPC(null)).toBeNull();
	});

	it("returns null for a non-object input", () => {
		expect(errorCodeFromTRPC("string error")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// errorCodeFromBetterAuth
// ---------------------------------------------------------------------------

/**
 * Better Auth's typed client surfaces `code` directly at `result.error.code`
 * (the generic `Error$1<{ code?: string; ... }>` maps it to the top level).
 * Tests mirror this: `{ error: { code: "..." } }`.
 */
describe("errorCodeFromBetterAuth", () => {
	it("maps INVALID_EMAIL_OR_PASSWORD to INVALID_CREDENTIALS", () => {
		const result = { error: { code: "INVALID_EMAIL_OR_PASSWORD" } };
		expect(errorCodeFromBetterAuth(result)).toBe("INVALID_CREDENTIALS");
	});

	it("maps INVALID_EMAIL to INVALID_CREDENTIALS", () => {
		const result = { error: { code: "INVALID_EMAIL" } };
		expect(errorCodeFromBetterAuth(result)).toBe("INVALID_CREDENTIALS");
	});

	it("maps USER_ALREADY_EXISTS to EMAIL_TAKEN", () => {
		const result = { error: { code: "USER_ALREADY_EXISTS" } };
		expect(errorCodeFromBetterAuth(result)).toBe("EMAIL_TAKEN");
	});

	it("maps USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL to EMAIL_TAKEN", () => {
		const result = {
			error: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
		};
		expect(errorCodeFromBetterAuth(result)).toBe("EMAIL_TAKEN");
	});

	it("maps PASSWORD_TOO_SHORT to WEAK_PASSWORD", () => {
		const result = { error: { code: "PASSWORD_TOO_SHORT" } };
		expect(errorCodeFromBetterAuth(result)).toBe("WEAK_PASSWORD");
	});

	it("maps PASSWORD_TOO_LONG to WEAK_PASSWORD", () => {
		const result = { error: { code: "PASSWORD_TOO_LONG" } };
		expect(errorCodeFromBetterAuth(result)).toBe("WEAK_PASSWORD");
	});

	it("returns null for an unknown Better Auth code", () => {
		const result = { error: { code: "SOME_UNHANDLED_CODE" } };
		expect(errorCodeFromBetterAuth(result)).toBeNull();
	});

	it("returns null when result is null / undefined / empty", () => {
		expect(errorCodeFromBetterAuth(null)).toBeNull();
		expect(errorCodeFromBetterAuth(undefined)).toBeNull();
		expect(errorCodeFromBetterAuth({})).toBeNull();
	});

	it("returns null when error has no code field", () => {
		const result = { error: { code: null } };
		expect(errorCodeFromBetterAuth(result)).toBeNull();
	});
});
