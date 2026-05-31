# Issue 01 — i18n foundation + format/parse module (tracer bullet)

**Type:** AFK

## Parent

`plans/i18n/prd.md` — Internationalization (German + English, locale-aware formatting, currency).

## What to build

The end-to-end Lingui plumbing plus the formatting seam, proven on one tiny surface so
the cross-cutting architecture is verified before any bulk translation work.

- Install and configure Lingui (core, react, macros, vite-plugin, cli). Enable the
  **Babel macro** via the existing `@vitejs/plugin-react` (no plugin swap). Add a
  `lingui.config.*` and `extract`/`compile` scripts. Create `en` and `de` catalogs.
- Stand up a **request-scoped i18n instance** and an `I18nProvider` wrapping the tree on
  **both server and client**. **Bundle both catalogs.**
- Build the **locale/currency resolver** (Module A): pure precedence logic
  userPref → cookie → `Accept-Language` (de/en) → default `en`/EUR. Read the cookie in the
  root on the server; bind **`<html lang>`** to the resolved locale.
- Build the **format/parse module** (Module B) behind a `useFormat()` hook fed by
  `{ locale, currency }` from context: `formatMoney`, `formatDate`, compact axis formatter,
  locale-aware `parseAmount`. **Slim `Money`** to a pure value object (cents + arithmetic +
  keypad `fromDecimalString`); move display/locale-parse into Module B.
- Add the static **locale & currency config** (Module D): supported locales, EUR/USD/GBP/CHF.
- **Prove it:** localize the bottom-nav labels and one money display with `<Trans>` +
  `formatMoney`, switching purely off the cookie/Accept-Language (no switcher, no DB yet;
  currency hardcoded to EUR for this slice).

## Acceptance criteria

- [ ] `pnpm dev` renders the bottom-nav labels in German when the cookie/`Accept-Language` is `de`, English otherwise — correct on the **server-rendered first paint** (view source), not just after hydration.
- [ ] **No hydration mismatch** warnings in the console for the localized surface.
- [ ] `<html lang>` reflects the resolved locale (`de`/`en`).
- [ ] `lingui extract` and `lingui compile` run via pnpm scripts and produce `en`/`de` catalogs.
- [ ] `Money` no longer formats or parses locale strings; arithmetic + keypad parsing still pass their existing tests.
- [ ] Unit tests for **Module A** (precedence/fallbacks) and **Module B** (`formatMoney`/`formatDate`/axis per locale×currency, `parseAmount` comma/dot + edge cases) pass; the relevant `money.test.ts` formatting/parsing assertions are migrated into Module B's tests.
- [ ] `pnpm exec tsc --noEmit`, `pnpm check`, and `pnpm test` are green.

## Blocked by

- None — can start immediately.
