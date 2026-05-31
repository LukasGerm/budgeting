/**
 * Module H — stable, locale-agnostic application error codes.
 *
 * This module is importable by both the tRPC router (server) and client-side
 * hooks without pulling in React, Lingui, or any browser-only API. Keep it
 * pure: no imports, no side effects.
 *
 * Convention: each code is an UPPER_SNAKE_CASE string. The client-side
 * `useErrorMessage()` hook maps these to translated user-facing messages.
 */

/** All stable, machine-readable error codes the app can surface. */
export const APP_ERROR_CODES = [
	// Expense validation
	"SPEND_NOT_POSITIVE",
	"ADJUSTMENT_ZERO",
	"AMOUNT_ZERO",

	// Budget / onboarding / settings
	"BUDGET_NOT_POSITIVE",
	"ANCHOR_OUT_OF_RANGE",
	"INVALID_AMOUNT",

	// Habits / notes
	"HABIT_NAME_REQUIRED",
	"HABIT_NAME_TOO_LONG",
	"NOTE_TOO_LONG",

	// Auth
	"INVALID_CREDENTIALS",
	"EMAIL_TAKEN",
	"WEAK_PASSWORD",

	// Generic fallbacks
	"SAVE_FAILED",
	"UNKNOWN",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

/** Type-guard: returns true when `code` is a known `AppErrorCode`. */
export function isAppErrorCode(code: unknown): code is AppErrorCode {
	return (
		typeof code === "string" &&
		(APP_ERROR_CODES as readonly string[]).includes(code)
	);
}
