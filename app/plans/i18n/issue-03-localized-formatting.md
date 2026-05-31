# Issue 03 — Locale-aware formatting across all surfaces

**Type:** AFK

## Parent

`plans/i18n/prd.md`

## What to build

Route **every** number/date/currency rendering and amount parsing through the
`useFormat()` hook so formatting follows the active locale + currency everywhere — even
before the copy itself is translated.

- Replace every hardcoded `Intl(..., "de-DE")` call site with Module B via `useFormat()`:
  the home date label, dashboard charts (tooltips, month abbreviations, Y-axis compact
  formatter), and any other inline `Intl` usage.
- Make the **settings budget input locale-aware**: prefill and parse using `parseAmount`
  (German comma / English dot). Keep the numeric-**keypad** spend entry locale-independent.
- Refactor **domain copy-builders** (Module E) — e.g. `formatMonthlyStatus`,
  `formatRelativeDate` — to **return structured data** instead of finished strings; keep
  the relative-date bucketing (today / yesterday / N-days-ago) as a pure function. (The
  translated sentence assembly is added in the string-translation slices.)

## Acceptance criteria

- [ ] With language = English, **all** amounts render `1,234.56`-style and dates render English-style ("Saturday, 31 May"); with German, `1.234,56` and "Samstag, 31. Mai" — across home, dashboard charts/axes, and history.
- [ ] With currency = USD/GBP/CHF, every amount shows the correct symbol/format; switching does **not** change the underlying numbers.
- [ ] The settings budget input accepts `300,50` in German and `300.50` in English; the numeric keypad spend entry is unaffected.
- [ ] No remaining hardcoded `"de-DE"` `Intl` usage in the codebase.
- [ ] Module E unit tests assert structured-data output; `relative-date` buckets unchanged. Migrated `monthly-status.test.ts` / `relative-date.test.ts` pass.
- [ ] `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test` green.

## Blocked by

- Issue 01 (i18n foundation + format/parse module).
