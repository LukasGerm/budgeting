/**
 * Module H — client-side error code → translated message map.
 *
 * `useErrorMessage()` returns a stable `getErrorMessage` function that maps a
 * known `AppErrorCode` (or any string/null/undefined) to a translated,
 * user-facing sentence. Unknown or missing codes fall back to the generic
 * `SAVE_FAILED` message — never blank, never the raw code.
 *
 * `errorCodeFromTRPC(error)` extracts the `appErrorCode` from a tRPC error
 * response (set by the `errorFormatter` in `init.ts`). Returns null when no
 * recognised code is present.
 *
 * `errorCodeFromBetterAuth(error)` maps a Better Auth client error to one of
 * the app's auth codes.
 */

import { useLingui } from "@lingui/react/macro";
import type { TRPCClientError } from "@trpc/client";
import { isAppErrorCode } from "#/i18n/error-codes";
import type { TRPCRouter } from "#/integrations/trpc/router";

// ---------------------------------------------------------------------------
// useErrorMessage
// ---------------------------------------------------------------------------

/**
 * Returns a `getErrorMessage(code)` function that maps any `AppErrorCode` (or
 * unknown/null/undefined) to a translated user-facing string. Lingui extracts
 * the `t\`…\`` literals at build time so all messages land in the catalog.
 *
 * Usage:
 *   const getErrorMessage = useErrorMessage();
 *   toast.error(getErrorMessage(errorCodeFromTRPC(e)));
 */
export function useErrorMessage(): (code: string | null | undefined) => string {
	const { t } = useLingui();

	return function getErrorMessage(code: string | null | undefined): string {
		switch (code) {
			// Expense validation
			case "SPEND_NOT_POSITIVE":
				return t`A spend amount must be positive.`;
			case "ADJUSTMENT_ZERO":
				return t`An adjustment amount must be non-zero.`;
			case "AMOUNT_ZERO":
				return t`Amount must be non-zero.`;

			// Budget / onboarding / settings
			case "BUDGET_NOT_POSITIVE":
				return t`Budget must be greater than zero.`;
			case "ANCHOR_OUT_OF_RANGE":
				return t`Anchor day must be between 1 and 31.`;
			case "INVALID_AMOUNT":
				return t`Enter a valid amount (e.g. 300 or 1234.50).`;

			// Habits / notes
			case "HABIT_NAME_REQUIRED":
				return t`Habit name can't be empty.`;
			case "HABIT_NAME_TOO_LONG":
				return t`Habit name must be 60 characters or fewer.`;
			case "NOTE_TOO_LONG":
				return t`Note must be 280 characters or fewer.`;

			// Auth
			case "INVALID_CREDENTIALS":
				return t`Invalid email or password.`;
			case "EMAIL_TAKEN":
				return t`An account with this email already exists.`;
			case "WEAK_PASSWORD":
				return t`Password must be at least 8 characters.`;

			// Generic fallback — covers SAVE_FAILED, UNKNOWN, and any unrecognised code.
			default:
				return t`Something went wrong. Check your connection and try again.`;
		}
	};
}

// ---------------------------------------------------------------------------
// errorCodeFromTRPC
// ---------------------------------------------------------------------------

/**
 * Extracts the stable `appErrorCode` set by the tRPC `errorFormatter`.
 * Returns null when no recognised code is present so callers can fall back to
 * `"SAVE_FAILED"`.
 */
export function errorCodeFromTRPC(
	error: TRPCClientError<TRPCRouter> | unknown,
): string | null {
	if (!error || typeof error !== "object") return null;
	const e = error as { data?: { appErrorCode?: unknown } };
	const code = e.data?.appErrorCode;
	if (typeof code === "string" && isAppErrorCode(code)) return code;
	return null;
}

// ---------------------------------------------------------------------------
// errorCodeFromBetterAuth
// ---------------------------------------------------------------------------

/**
 * Maps a Better Auth client result to one of the app's auth `AppErrorCode`
 * values.
 *
 * Better Auth's TypeScript client types the error result as
 * `{ error: Error$1<{ code?: string; message?: string; }> }` where `code` is
 * directly readable from `result.error.code` (the typed API surface). At
 * runtime, the raw HTTP JSON body sits on `BetterFetchError.error`, but the
 * Better Auth client generics surface `code` directly on the error object.
 *
 * Pass the entire `result` from `authClient.signIn.email(...)` etc.
 *
 * Returns null for unmapped/unknown codes; callers fall back to `"UNKNOWN"`.
 */
export function errorCodeFromBetterAuth(
	result: { error?: { code?: string | null } | null } | null | undefined,
): string | null {
	const code = result?.error?.code;
	if (typeof code !== "string") return null;

	switch (code) {
		case "INVALID_EMAIL_OR_PASSWORD":
		case "INVALID_EMAIL":
		case "INVALID_PASSWORD":
			return "INVALID_CREDENTIALS";
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return "EMAIL_TAKEN";
		case "PASSWORD_TOO_SHORT":
		case "PASSWORD_TOO_LONG":
			return "WEAK_PASSWORD";
		default:
			return null;
	}
}
