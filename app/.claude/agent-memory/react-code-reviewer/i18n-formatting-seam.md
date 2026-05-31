---
name: i18n-formatting-seam
description: Module B/E i18n formatting — useFormat() at component edge, Money has no format(), domain copy-builders return structured unions, settings key-remount replaced useEffect
metadata:
  type: project
---

Issue 03 wired locale-aware formatting across all surfaces; Module E refactored domain copy-builders to structured data. See [[i18n-foundation]], [[i18n-preferences-switcher]], [[money-domain]].

**Formatting seam (Module B).** All number/date/currency rendering goes through `useFormat()` (src/i18n/use-format.ts), which binds the pure functions in `src/i18n/format.ts` to `{locale,currency}` from `useLocaleContext()`. Returned fns: `formatMoney(cents)`, `formatDate(date, "long"|"short"|"numeric")`, `formatAxisCents(cents)`, `parseAmount(input)`, `centsToInputString(cents)`. `Money.format()`/`Money.fromEuroString()` were REMOVED — flag any reappearance; use `formatMoney(x.toCents())` / `Money.fromCents(parseAmount(x))`.
- **Why:** locale is server-resolved once (root loader `getResolvedPrefs` → `I18nSetupProvider` seeds `useState`), so format fns reading context give hydration-parity. The old `de-DE` Intl was hardcoded.
- **How to apply:** flag any `new Intl.*` or `"de-DE"` literal outside `src/i18n/format.ts` (test-description comments are fine). Charts must capture `useFormat()` fns in the COMPONENT BODY, never call hooks inside a Recharts formatter callback (see [[dashboard-charts.md]]). Only `pace-line-chart` has a money Y-axis (`formatAxisCents`); other charts' Y-axes are `hide`/day-indexed. The numeric keypad stays locale-independent (always emits ".").

**Module E — domain copy-builders return structured data, not strings.** `getMonthlyStatus(...)→MonthlyStatus` discriminated union `{kind:"over_budget"|"on_track", ...cents/days}`; `getRelativeDate(date,now)→RelativeDate` union `{kind:"today"|"yesterday"|"days_ago", days?}`. Both pure/clock-free (`now` injected, no `new Date()`/Intl inside). `calendarDaysAgo` exported & pure. The component assembles the (currently English) sentence from the union via `formatMoney`; <Trans> assembly deferred to Issue 04.
- **Why:** keeps domain framework-agnostic and translation comes later at the UI edge.
- **How to apply:** call sites must handle the union exhaustively (2-variant ternary / 3-branch if-chain — no missing branch, no `as`). over_budget passes the NEGATIVE remainingCents to `formatMoney` to reproduce the old leading-minus. The set-aside sign is a literal U+2212 ("−") prepended to a `Math.abs` magnitude — not Intl's negative glyph. Tests assert the union shape (`.toEqual({kind:...})`, `"elapsedDays" in status === false`), not finished prose.

**Settings BudgetForm — key-remount replaced a useEffect.** `SettingsPage` derives `initialAmount = centsToInputString(loadedCents)` at render and mounts `<BudgetForm key={`${loadedCents}-${loadedAnchor}`} .../>`; BudgetForm seeds `useState` from props. The old `useEffect` that mirrored server budget into local state is GONE — this is the canonical "remount via key to re-seed defaults" pattern, prefer it over effects.
- **Known gap (non-blocking):** the `key` omits locale, so switching language while BudgetForm is mounted does NOT re-prefill the input separator (300,00 stays, then `parseAmount(...,"en")` rejects the comma). The file-header comment claiming locale changes "remount-with-correct-defaults" is inaccurate — I18nSetupProvider re-renders but does not remount children on locale change.
