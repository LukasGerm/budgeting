---
name: i18n-localized-errors
description: Issue 06 Module H — server error codes → client-translated copy; verified tRPC-cause/zod-v4/Better-Auth runtime chains; settings re-throw-pretranslated pattern; uncovered expense edit/delete error path
metadata:
  type: project
---

Module H localized errors (Issue 06). The canonical error pipeline in this repo.

**Architecture (all verified against installed runtime, not just types):**
- `src/i18n/error-codes.ts` — PURE module (zero imports), `APP_ERROR_CODES` const tuple + `AppErrorCode` type + `isAppErrorCode`. Imported by BOTH server (`init.ts`) and client (`use-error-message.ts`). Keep it import-free.
- `src/integrations/trpc/init.ts` `errorFormatter` — reads `error.cause.issues[0].message` (ZodError) or `error.message` (manual TRPCError), validates via `isAppErrorCode`, surfaces on `shape.data.appErrorCode` (null otherwise → generic fallback).
- `src/i18n/use-error-message.ts` — `useErrorMessage()` hook returns `getErrorMessage(code)` (switch over codes, `t\`…\`` literals, default = generic). Plus pure helpers `errorCodeFromTRPC(e)` (reads `e.data?.appErrorCode`) and `errorCodeFromBetterAuth(result)` (maps `result.error.code`).
- Router (`router.ts`) zod messages ARE codes (`.nonnegative("BUDGET_NOT_POSITIVE")`, `superRefine` `addIssue({message:"SPEND_NOT_POSITIVE"})`, etc.). Every router code is string-for-string present in `APP_ERROR_CODES`.

**Runtime facts I verified (so future reviews don't re-trace):**
- zod is v4 (`^4.3.6`). `z.ZodError` + `z.ZodIssueCode.custom` resolve on the root `zod` import. tRPC v11's `getParseFn` prefers `parser.parseAsync` over the `~standard` branch, so a zod-v4 input failure throws a real `ZodError` (NOT `StandardSchemaV1Error`) → `error.cause instanceof ZodError` is correct. `issues[0].message` == our code string.
- tRPC v11 `getTRPCErrorFromUnknown` sets the original thrown error as `.cause`. Default shape is `data:{code,httpStatus,path}`; custom formatter spreads `...shape.data` + `appErrorCode`. Plain string round-trips superjson → client reads `error.data?.appErrorCode`. Sound.
- Better Auth v1.5: server throws `APIError.from(status, BASE_ERROR_CODES.X)` where `defineErrorCodes` wraps each as `{code:KEY, message, toString}` → response body `{message, code:"INVALID_EMAIL_OR_PASSWORD"}`. Client (@better-fetch) returns that body as `result.error`. So `result.error.code` IS populated — the implementer's `result.error.code` (plan said `result.error.error.code`) is CORRECT; the plan was wrong. Mapped codes (INVALID_EMAIL_OR_PASSWORD, INVALID_EMAIL, INVALID_PASSWORD, USER_ALREADY_EXISTS[_USE_ANOTHER_EMAIL], PASSWORD_TOO_SHORT/LONG) all exist in `@better-auth/core/dist/error/codes.mjs`.

**Settings re-throw pattern (settings.tsx):** `SettingsPage.handleSave` catches `mutateAsync` error and `throw new Error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"))` — re-throws a PRE-TRANSLATED message. `BudgetForm.handleSubmit` catch does `setError(e.message)`. The `e.message` here is NOT a raw-prose leak because handleSave is the only thrower and always wraps. The `: getErrorMessage("SAVE_FAILED")` ternary branch is effectively dead (handleSave always throws an Error) but harmless.

**Known gap (flagged, non-blocking):** `history.tsx` fires `updateExpense.mutate(input)` / `deleteExpense.mutate({id})` with NO `onError`. The router added `AMOUNT_ZERO`/`NOTE_TOO_LONG` codes for `expense.update`, but this client path silently swallows them. Pre-existing, but Issue 06 made it newly relevant. See [[trpc-router-conventions]] for the two accepted write-hook variants.

**Test-coverage gap (suggestion):** router tests use `rejects.toThrow()` with NO message assertion, so nothing guards the string-for-string router-code ↔ APP_ERROR_CODES contract. Rename a router code and `isAppErrorCode` silently returns null (generic fallback) with green tests.

Related: [[i18n-formatting-seam]] (useFormat seam, settings key-remount-not-useEffect), [[i18n-foundation]], [[i18n-translate-auth-onboarding-settings]].
</content>
</invoke>
