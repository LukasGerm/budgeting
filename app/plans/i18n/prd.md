# PRD — Internationalization (i18n): German + English, locale-aware formatting, user-selectable currency

> Local PRD. Companion issues live beside this file as `issue-01..07-*.md`.
> Library: **Lingui**. Status: planned, not built.

## Problem Statement

The app is a personal budgeting PWA, but its language is frozen: every user-facing
string is hardcoded in English, while — confusingly — all *formatting* is hardcoded
to German conventions (money via `Intl.NumberFormat("de-DE")` → `1.234,56 €`, dates
via `Intl.DateTimeFormat("de-DE")` → `"Samstag, 31. Mai"`, and the budget input only
accepts a German comma decimal). `<html lang>` is hardcoded to `"en"`. A user cannot
read the app in their own language, cannot get number/date formatting that matches
that language, and cannot budget in a currency other than the euro. The product is
effectively a half-localized hybrid that serves no one cleanly.

## Solution

Introduce full internationalization with Lingui:

- The whole UI is available in **German and English**, switchable by the user, with
  the choice **persisted per-account and synced across devices**.
- **Number, date, and currency formatting follow the active language** — switching to
  English yields English-style dates and `1,234.56`; German yields `1.234,56`.
- The user can pick their **currency** (EUR, USD, GBP, CHF) independently of language.
  This is a **display-only** choice: amounts are stored as raw minor units and are
  **never converted**; only the symbol and number format change.
- First-time visitors are served the right language automatically (browser
  `Accept-Language`), and the choice they make later overrides it.
- Switching language is **instant** (no page reload / no flash).

## User Stories

1. As a German-speaking user, I want the entire interface in German, so that I can use the app comfortably in my native language.
2. As an English-speaking user, I want the entire interface in English, so that I can understand every label and message.
3. As a user, I want to change the app language from a settings screen, so that I'm not stuck with whatever language I was first shown.
4. As a user, I want my language choice to persist after I close and reopen the app, so that I don't re-set it every visit.
5. As a user with more than one device, I want my language choice to follow my account, so that the app looks the same on my phone and laptop.
6. As a first-time visitor, I want the app to open in the language my browser/OS prefers (German or English), so that the very first screen already makes sense.
7. As a first-time visitor whose browser language is neither German nor English, I want a sensible default (English), so that I'm never shown a broken or empty UI.
8. As a user, I want the language to switch instantly when I pick it, so that the app feels responsive and I'm not interrupted by a reload.
9. As a German-speaking user, I want dates written in German format (e.g. "Samstag, 31. Mai"), so that dates read naturally to me.
10. As an English-speaking user, I want dates written in English format (e.g. "Saturday, 31 May"), so that dates read naturally to me.
11. As a German-speaking user, I want amounts formatted German-style (`1.234,56`), so that numbers look correct to me.
12. As an English-speaking user, I want amounts formatted English-style (`1,234.56`), so that numbers look correct to me.
13. As a user, I want to choose the currency my budget is shown in (EUR, USD, GBP, CHF), so that the app reflects the money I actually think in.
14. As a user, I want changing the currency to only change the symbol and formatting (not silently convert my numbers), so that I'm never confused about whether my data was rewritten.
15. As a user, I want my currency choice to be independent of my language, so that I can use, say, German with Swiss francs.
16. As a user, I want my currency choice persisted and synced like my language, so that it behaves consistently across sessions and devices.
17. As a German-speaking user, I want the budget amount input to accept a comma decimal (`300,50`), so that I can type the way I naturally would.
18. As an English-speaking user, I want the budget amount input to accept a dot decimal (`300.50`), so that I can type the way I naturally would.
19. As a user logging a spend on the numeric keypad, I want amount entry to keep working regardless of language, so that quick entry is never blocked by locale rules.
20. As a user, I want validation and error messages (e.g. "budget must be greater than zero", "enter a valid amount") in my language, so that I understand what went wrong.
21. As a user, I want toast/confirmation messages (e.g. "Budget updated", "Logged €5") in my language, so that feedback is consistent with the rest of the UI.
22. As a screen-reader user, I want aria-labels and accessible names translated, so that assistive tech announces content in my language.
23. As a user, I want the chart labels and captions on the dashboard translated and locale-formatted, so that the insights are readable in my language.
24. As a user, I want the very first server-rendered paint to already be in my language and currency, so that there's no flash of the wrong language or wrong number format.
25. As a user on assistive tech / SEO tooling, I want `<html lang>` to reflect the active language, so that the document is correctly described.
26. As a user who hasn't logged in yet (login/signup), I want those pages in my detected language too, so that localization isn't limited to the authed area.
27. As the product owner, I want German copy in the informal "du" register, so that the tone matches a personal consumer finance app.
28. As a developer, I want the backend to stay language-agnostic, so that the API isn't coupled to translation concerns.
29. As a developer, I want translatable copy centralized in catalogs, so that translations are extractable and maintainable.

## Implementation Decisions

### Scope
- Full localization: **UI strings + locale-aware number/date formatting + user-selectable currency**.
- Languages: **German and English**. German source register: **informal "du"**. English is the **source language**; German is the translated catalog.

### Currency model
- **Display-only, no conversion.** Currency is independent of language. Curated **2-decimal** list: **EUR, USD, GBP, CHF**. Amounts remain raw integer minor units; switching currency changes only symbol + formatting. Default **EUR**. Multi-currency conversion (exchange rates, historical rates) is out of scope.

### Locale resolution & routing
- **No URL prefix.** The route tree is unchanged; the active locale is resolved from a cookie + a per-user DB preference.
- **Resolution precedence:** user preference → cookie → `Accept-Language` header (de/en) → default `en`/EUR. This precedence lives in an isolated, pure **locale/currency resolver** module (Module A).
- The **cookie is the SSR fast-path** the server reads synchronously before render. The **per-user DB columns are the durable source** that seeds the cookie on login and is rewritten on change.

### Persistence
- `language` and `currency` are stored as **Better Auth `additionalFields`** on the user record (so they ride along in the session already loaded in `_authed.beforeLoad` and in the tRPC context). Prisma migration adds the columns with safe defaults (`language='en'`, `currency='EUR'`) so existing rows don't break.
- A tRPC `user.setPreferences` mutation writes the DB columns, sets the cookie, and ensures the session reflects the new value (refresh/invalidate the Better Auth session cache as needed).

### Runtime / SSR
- Lingui **macros** (`<Trans>`, `t`, `msg`, `plural`) authored throughout. Enabled via the **Babel macro plugin added to the existing `@vitejs/plugin-react`** (it runs Babel, so **no plugin swap**), plus `@lingui/vite-plugin` to load compiled catalogs.
- **Request-scoped i18n instance** on the server (never the shared singleton) to prevent locale bleeding across concurrent SSR requests; `I18nProvider` wraps the tree on both server and client.
- **Both catalogs are bundled** (two small locales) so language switching has zero network wait and SSR stays simple.
- `<html lang>` is bound to the resolved locale.

### Switch UX
- **Instant client swap:** `i18n.activate(locale)` + re-render with no flash; cookie + DB persisted in the background; `<html lang>` updated. Currency change is pure client-side reformatting + persist.

### Formatting seam (lift to view layer)
- A **format/parse module** (Module B), surfaced via a `useFormat()` hook that knows `{ locale, currency }` from context, owns: `formatMoney(cents)`, `formatDate(date, style)`, the compact axis formatter, and **locale-aware** `parseAmount(input)` (comma vs dot by language).
- **`Money` becomes a pure value object** (cents + arithmetic). Its display `.format()` and locale parsing move into Module B. The numeric-keypad path (`fromDecimalString`, dot-only) stays on the value object and is **locale-independent** (the keypad only emits ".").
- **Domain copy-builders** (e.g. `formatMonthlyStatus`, `formatRelativeDate`) return **structured data**; the relative-date *bucketing* (today / yesterday / N-days-ago) stays a pure function; sentence assembly moves into components via `<Trans>` + `plural`.
- Every existing `Intl(..., "de-DE")` call site (home date label, dashboard charts, month abbreviations, Y-axis formatter, settings prefill/parse) is rerouted through Module B with the active locale + currency.

### Errors & validation
- **Server returns stable codes; client translates.** tRPC procedures and zod schemas emit locale-agnostic error codes/keys (e.g. `BUDGET_NOT_POSITIVE`, `INVALID_AMOUNT`); a client-side **code → message map** (Module H) renders the translated copy. Inline form validation is translated in the component. The backend never returns user-facing prose.

### Module map
- **A · Locale/currency resolver** — pure precedence/fallback logic. *Tested.*
- **B · Format/parse module** (`useFormat()` hook) — pure money/date formatters + locale-aware parser + axis formatter. *Tested.*
- **C · `Money` value object (slimmed)** — cents + arithmetic + keypad parse; display/locale-parse removed. *Existing arithmetic tests retained.*
- **D · Locale & currency config** — static supported-locale list + EUR/USD/GBP/CHF set. Data only.
- **E · Domain copy-builders refactor** — return structured data; relative-date buckets stay pure. *Tested.*
- **F · i18n runtime** — request-scoped `I18nProvider` (server+client), bundled catalogs, dynamic `<html lang>`, root cookie read. Browser-verified.
- **G · Preference persistence** — Better Auth `additionalFields` + migration + `user.setPreferences` tRPC. *Tested (tRPC router test).* 
- **H · Error-code → message map** — server codes + client translation map.
- **I · Switcher UI** — settings language + currency `Select`s, instant `i18n.activate`.

## Testing Decisions

**What makes a good test here:** assert *external behavior*, not implementation details. Prefer pure-function unit tests for logic with many branches (precedence, formatting, parsing edge cases) and Testing Library component tests for rendered behavior. Component tests after i18n must render inside an `I18nProvider` + locale/currency context and assert per-locale output (or assert locale-agnostic structure where copy is incidental).

**Prior art in the repo:**
- Pure-function unit tests: `src/domain/money.test.ts`, `src/domain/monthly-status.test.ts`, `src/domain/relative-date.test.ts` (vitest `describe/it/expect`).
- Component tests: `src/components/dashboard/headline-stats.test.tsx` and siblings (`// @vitest-environment jsdom`, `@testing-library/react` `render`/`screen`, `afterEach` cleanup).
- tRPC router tests: `src/integrations/trpc/router.test.ts`, `src/integrations/trpc/habit-router.test.ts`.

**Modules to be unit-tested:**
- **A · resolver** — precedence chain & fallbacks (userPref > cookie > Accept-Language > default; unsupported header → en; cookie overrides header; userPref overrides cookie).
- **B · format/parse** — `formatMoney` per locale×currency (incl. NBSP handling like the current `money.test`), `formatDate` per locale, compact axis formatter, and `parseAmount` (comma vs dot, whitespace, negatives, too-many-decimals rejected, empty rejected/zero per current contract).
- **E · domain copy-builders** — refactored functions return correct structured data; relative-date buckets (today/yesterday/N days) unchanged.
- **G · preferences** — `user.setPreferences` persists language+currency and is reflected on subsequent reads (tRPC router test style).

**Test migration (part of the work, not optional):**
- `money.test.ts` formatting/locale-parsing assertions move to Module B's tests; arithmetic/keypad assertions stay on `Money`.
- `monthly-status.test.ts` / `relative-date.test.ts` shift from asserting finished strings to asserting structured data (+ the rendered sentence moves to component tests with `<Trans>`).
- `headline-stats.test.tsx` and other component tests are wrapped in providers and assert per-locale (e.g. EN `"1,234.56"` / `"Days left"`, DE `"1.234,56"` / `"Tage übrig"`).

## Out of Scope

- **Currency conversion** of any kind (exchange rates, historical rates, multi-currency ledgers). Currency is display-only.
- **Non-2-decimal currencies** (e.g. JPY, KWD) — would break the cents model.
- **Locale in the URL** (`/de`, `/en`) and any SEO/shareable-localized-URL behavior.
- **Languages beyond German and English.**
- **Server-side translated API responses** (the backend stays language-agnostic).
- **RTL languages / bidi**, pluralization rules beyond what de/en need.
- **Localizing the app/brand name** ("Budget(ing)" stays as-is).

## Further Notes

- **Implementation risks to watch:** (1) per-request i18n isolation on SSR (no shared singleton); (2) hydration parity — server and client must activate the *same* catalog before render, with the cookie as the single source both read, or React throws a hydration mismatch; (3) Better Auth session cache vs. direct Prisma update — the new preference must be reflected immediately after `setPreferences`.
- The numeric **keypad** spend-entry path (`fromDecimalString`) is intentionally locale-independent; only the **settings** text input is locale-aware.
- Relative dates intentionally keep the existing custom buckets (translated via `plural`) rather than switching to `Intl.RelativeTimeFormat`, to preserve current UX exactly.
- German translations are authored by the implementer in the informal "du" register and checked by the reviewer agent against the catalog (no human-review gate; all slices are AFK). The user can still review the copy at any time, but it does not block a slice.
- Per the repo workflow (CLAUDE.md), each slice is implemented by `react-tanstack-implementer`, reviewed by `react-code-reviewer`, and the whole feature is smoke-tested by `browser-change-verifier` before it's considered done.
