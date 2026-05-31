---
name: i18n-architecture
description: i18n module map, cookie names, SSR hydration wiring, Lingui v6 vite setup, and preference persistence (Issue 01+02) for this project
metadata:
  type: project
---

**Modules built (Issue 01):**
- **A** `src/i18n/resolver.ts` — pure precedence: userPref → cookie → Accept-Language → default en/EUR
- **B** `src/i18n/format.ts` + `src/i18n/use-format.ts` — formatMoney, formatDate, formatAxisCents, parseAmount, centsToInputString
- **C** `src/domain/money.ts` — slimmed: no format(), no fromEuroString(); only arithmetic + keypad fromDecimalString/toDecimalString
- **D** `src/i18n/config.ts` — SUPPORTED_LOCALES, SUPPORTED_CURRENCIES, LOCALE_COOKIE, CURRENCY_COOKIE, defaults
- **F** `src/i18n/provider.tsx` — I18nSetupProvider: client-stateful via useState seeded from server props; per-render i18n instance via buildI18n(locale)

**Modules built (Issue 02):**
- **G** `src/integrations/trpc/router.ts` → `user.setPreferences` mutation: writes language+currency to DB, sets locale/currency cookies via `setCookie` from `@tanstack/react-start/server`
- **I** `src/routes/_authed/settings.tsx` → `PreferencesSwitcher` component with shadcn `Select` for language (EN/DE) and currency (EUR/USD/GBP/CHF)

**Prisma schema:** `User` model has `language String @default("en")` and `currency String @default("EUR")`. Migration: `20260531000000_add_user_language_currency`.

**Better Auth additionalFields:** `language` and `currency` declared in `src/lib/auth.ts` with `input: false` (server-write-only). No cookie-cache configured — `getSession` always reads fresh from DB, so a `prisma.user.update` in `setPreferences` is immediately visible to the next `getResolvedPrefs` call.

**Locale server resolution (Issue 02 update):** `src/i18n/locale-server.ts` now calls `auth.api.getSession({ headers: request.headers })` and passes `session.user.language` / `session.user.currency` as `userLocale`/`userCurrency` to `resolvePrefs`. Logged-out requests fall through to cookie/Accept-Language.

**Client-stateful provider pattern (hydration-safe):**
- `I18nSetupProvider` holds `useState(() => ({ locale: initialLocale, currency: initialCurrency }))` seeded from server-resolved props
- `buildI18n(state.locale)` called synchronously during render (not in an effect) so catalog is correct on both SSR and client
- `setPreferences` in `LocaleContext`: updates state → instant re-render; sets `document.documentElement.lang` (imperative DOM sync); calls `onSetPreferences` prop which fires the tRPC mutation in background
- `__root.tsx` RootDocument wires `useMutation(trpc.user.setPreferences.mutationOptions())` and passes it as `onSetPreferences` to the provider

**Cookie names:** `locale` and `currency` (defined in `src/i18n/config.ts`).

**Server header reading:** Use `getRequest()` from `@tanstack/react-start/server` (NOT `getWebRequest()`).

**setCookie in tRPC procedures:** `setCookie` from `@tanstack/react-start/server` works inside tRPC route handlers because tRPC runs inside TanStack Start's AsyncLocalStorage request scope.

**SSR hydration parity:** Root loader calls `getResolvedPrefs()` server fn → returns `{ locale, currency }` → passed to `RootDocument` via `Route.useLoaderData()` → `<html lang={prefs.locale}>` + `I18nSetupProvider locale= currency=`. Both server and client read the same resolved value from the loader, preventing hydration mismatch.

**Test pattern for LocaleContext:** Component tests that render with `<LocaleContext.Provider value={...}>` must include `setPreferences: () => {}` in the value object (added in Issue 02).

**Vite setup (Lingui v6 + @vitejs/plugin-react v6):**
- `@vitejs/plugin-react` v6 dropped the `babel` option — use `@rolldown/plugin-babel` with `linguiTransformerBabelPreset` instead
- Plugin order: `viteReact()`, then `lingui()`, then `babel({ presets: [linguiTransformerBabelPreset()] })`

**Locales:** `src/locales/en/messages.po` + compiled `messages.ts` / `src/locales/de/messages.po` + compiled `messages.ts`

**formatMonthlyStatus bridge:** Accepts injected `formatMoney: (cents: number) => string` parameter (Issue 01 bridge; full refactor in Issue 03).

Related: [[lingui-v6-cli]]
