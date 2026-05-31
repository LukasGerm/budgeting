# Issue 06 — Localized error & validation messages (server codes → client copy)

**Type:** AFK

## Parent

`plans/i18n/prd.md`

## What to build

Localize all error and validation copy while keeping the backend language-agnostic.

- Refactor tRPC procedures and zod schemas to emit **stable, locale-agnostic error
  codes/keys** (e.g. `BUDGET_NOT_POSITIVE`, `INVALID_AMOUNT`) instead of English prose.
- Build the client-side **code → message map** (Module H) that renders the translated
  message via Lingui, used by toasts and inline form errors.
- Translate inline validation in forms (e.g. the settings budget validation) in the
  component layer.
- Extract → fill German ("du") → compile.

## Acceptance criteria

- [ ] Triggering validation/errors (e.g. empty/invalid budget, save failure) shows messages in the active language.
- [ ] The backend returns **codes only** — no user-facing prose in tRPC/zod responses.
- [ ] Every error code has both an English and a German message; unmapped codes fall back gracefully (no blank/raw-code shown to the user).
- [ ] German copy uses the informal "du" register throughout (verified by the reviewer agent against the catalog).
- [ ] `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test` green.

## Blocked by

- Issue 01 (foundation).
