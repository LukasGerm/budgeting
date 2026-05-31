# Issue 05 — Translate UI strings: auth, onboarding & settings

**Type:** AFK

## Parent

`plans/i18n/prd.md`

## What to build

Localize the remaining surfaces, including the **pre-auth** pages (which exercise the
cookie / `Accept-Language` path with no user preference yet).

- Surfaces: **login**, **signup**, **onboarding**, and the rest of **settings** copy
  (budget card, cycle-start help text, log-out) beyond the switcher built in Issue 02.
- Same macro discipline: `<Trans>` / `t` / `plural`, aria-labels included.
- Confirm the pre-auth pages localize correctly from `Accept-Language`/cookie before any
  account exists.
- Extract → fill German ("du") → compile.

## Acceptance criteria

- [ ] Login, signup, onboarding, and all settings copy are fully translated and flip between German and English.
- [ ] Logged-out visitors see login/signup in their detected language (German `Accept-Language` → German page) on the **server-rendered first paint**.
- [ ] German copy uses the informal "du" register throughout (verified by the reviewer agent against the catalog).
- [ ] No raw literals remain in these surfaces; no missing-message warnings.
- [ ] `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test` green.

## Blocked by

- Issue 01 (foundation) and Issue 03 (formatting — settings shows formatted amounts / locale-aware input).
