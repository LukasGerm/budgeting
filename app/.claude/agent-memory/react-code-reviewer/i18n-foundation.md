---
name: i18n-foundation
description: Lingui v6 i18n architecture (Issue 01) — modules, SSR hydration-parity flow, format/parse seam, deferred date sites
metadata:
  type: project
---

Lingui **v6** i18n landed in Issue 01 (`plans/i18n/prd.md`, `issue-01..07`). Foundation/tracer-bullet only; bulk translation + switcher + DB persistence come in later issues.

**Module map (src/i18n/):**
- `config.ts` — Module D, data only: `SUPPORTED_LOCALES` (en,de), `SUPPORTED_CURRENCIES` (EUR/USD/GBP/CHF), `DEFAULT_LOCALE`/`DEFAULT_CURRENCY`, `LOCALE_COOKIE`/`CURRENCY_COOKIE`.
- `resolver.ts` — Module A, pure precedence userPref→cookie→Accept-Language→default. `resolvePrefs(input)` + `parseAcceptLanguage`. No I/O.
- `locale-server.ts` — `getResolvedPrefs` = `createServerFn({method:"GET"})` reading cookie + accept-language via `getRequest()`.
- `format.ts` — Module B, pure framework-agnostic formatters taking explicit `(…, locale, currency)`: `formatMoney`, `formatDate`, `formatAxisCents`, `parseAmount`, `centsToInputString`. Uses `localeToIntl` (en→en-GB, de→de-DE).
- `use-format.ts` — `useFormat()` hook binds Module B fns to `{locale,currency}` from context. Call once at top of component; pass fns into Recharts callbacks (never call hooks inside callbacks).
- `locale-context.tsx` — `LocaleContext` `{locale,currency}`, read-only this slice (setter in Issue 02).
- `provider.tsx` — `I18nSetupProvider`: per-render `setupI18n()` (NO shared singleton — prevents SSR locale bleed), `.load(CATALOGS)`, `.activate(locale)`, wraps `I18nProvider` + `LocaleContext`. Both catalogs bundled statically.

**SSR hydration-parity flow (the top risk, verified sound):** root `__root.tsx` loader calls `getResolvedPrefs()` → returns `{prefs}`. TanStack Start **dehydrates loader data into the SSR payload; client hydrates from it, does NOT re-run the root loader for first paint** — so server+client read the same `prefs`. `<html lang={prefs.locale}>` is driven by resolved locale. Provider activates the catalog synchronously from that same `prefs`. Accept-Language (server-only) is therefore never re-resolved on the client. This is correct; still browser-verify no React #418.

**Vite macro wiring (novel, only a real build proves it):** `vite.config.ts` adds `lingui()` + `@rolldown/plugin-babel` with `linguiTransformerBabelPreset()` (both real exports of `@lingui/vite-plugin@6.1.0`) AFTER `viteReact()`. NOT the old `viteReact({babel:{plugins:[...]}})` form (plugin-react v6 dropped inline babel). `@rolldown/plugin-babel` DEFAULT_INCLUDE = `.[jt]sx?/[cm][jt]s`, excludes node_modules — works because Start v1.168 runs rolldown-vite. tsc/tests can't prove the runtime macro transform (tests never render `<Trans>`; `lingui extract` uses its own babel pass) → MUST browser-verify `<Trans>` actually translates.

**Macro import:** `import { Trans } from "@lingui/react/macro"` (macro, not runtime `@lingui/react`).

**Scripts:** `pnpm extract` (lingui extract), `pnpm compile` (--typescript --allow-empty → `src/locales/{en,de}/messages.ts` JSON-string catalogs).

**Money slimming (Module C):** `money.ts` lost `.format()` + `fromEuroString()`; keeps cents + arithmetic + keypad `fromDecimalString`/`toDecimalString` (locale-independent, dot-only). All `.format()` call sites rerouted to `useFormat().formatMoney(x.toCents())`. `monthly-status.ts formatMonthlyStatus` now takes an injected `formatMoney` fn (Issue 01 bridge; Issue 03 will make it return structured data).

**Deferred to Issue 03 (left intact, do NOT flag as missing):** home date label `index.tsx` `dateLabel` (hardcoded `de-DE`), `monthly-trend-chart.tsx` `MONTH_FORMATTER` (hardcoded `de-DE`), and the full Module E copy-builder refactor.

See [[money-domain]], [[dashboard-charts]].
