---
name: i18n-preferences-switcher
description: Issue 02 i18n — client-stateful I18nSetupProvider, setPreferences flow, user.setPreferences tRPC, root-loader session read, biome glob gotcha
metadata:
  type: project
---

Issue 02 (i18n preference persistence + instant switcher) shipped. Builds on [[i18n-foundation]].

**Stateful provider** (`src/i18n/provider.tsx`): `I18nSetupProvider` is now client-stateful — single `useState(() => ({locale, currency}))` lazily seeded from root-loader props (`Route.useLoaderData().prefs`). Hydration parity holds: init reads only props, no `navigator`/`document`/`Date`/random. `buildI18n(locale)` = fresh `setupI18n()` + `load(both catalogs)` + `activate` built synchronously during render (NOT in an effect) — correct for SSR isolation; per-render churn is cheap (two small bundled catalogs). `setPreferences` updates state, writes `document.documentElement.lang` imperatively (legit event-handler DOM sync, the `<html lang>` lives in the shell outside React), and calls `onSetPreferences` prop. `<html lang>` after reload re-seeds from loader (correct).

**Root shell** (`src/routes/__root.tsx`): `RootDocument` is the shell for ALL pages incl. logged-out `/login`,`/signup`. It calls `useMutation(trpc.user.setPreferences.mutationOptions())` via `useTRPC()`. Instantiating the hook does NOT fire a request — safe pre-auth/SSR. Mutation only fires from the settings switcher. Errors swallowed (fire-and-forget; DB recovers on next load).

**tRPC** (`src/integrations/trpc/router.ts`): `userRouter.setPreferences` = `protectedProcedure` (gates `ctx.userId`, throws UNAUTHORIZED), partial `z.enum(SUPPORTED_LOCALES/CURRENCIES).optional()`, builds `data` only from supplied fields, no-op early-return when empty, `prisma.user.update`, then `setCookie(LOCALE_COOKIE/CURRENCY_COOKIE, …, {path:"/", sameSite:"lax", maxAge:1yr})`. `setCookie` from `@tanstack/react-start/server` works in the tRPC fetch-handler AsyncLocalStorage scope. Returns nothing (no English prose — Issue 06 owns error copy).

**Auth** (`src/lib/auth.ts`): `additionalFields` language/currency, `input:false` (clients can't set at signup). NO session cookie-cache configured → `getSession` always fresh → `setPreferences` DB write immediately visible to next `getResolvedPrefs`. `session.user.language/currency` is genuinely typed (no `as any`; tsc clean).

**Resolver wiring** (`src/i18n/locale-server.ts`): `getResolvedPrefs` server fn reads `auth.api.getSession` and feeds `userLocale/userCurrency` (nullsafe `??null`) into `resolvePrefs`. Logged-out → session null → falls through to cookie/Accept-Language/default. Invalid stored values can't break: resolver re-validates each tier via `isSupportedLocale/Currency`.

**Known consideration (non-blocking):** root loader `getResolvedPrefs` does a full `getSession` on EVERY request; `_authed.beforeLoad` does another via `getServerSession`. Two session reads per authed nav. Pre-existing (loader added Issue 01); Issue 02 only added DB-field read to the same call.

**Biome glob gotcha:** `biome.json` overrides changed `!**/src/generated/**`→`!**/src/generated` and `!**/src/components/ui/**`→`!**/src/components/ui`. Verified both still fully ignore the directory + contents (shadcn `ui/select.tsx` 2-space and generated Prisma are still skipped — biome reports "paths were ignored"). Don't flag 2-space indent in `ui/`.

**Scope bleed:** `_authed/index.tsx` + `onboarding.tsx` already route through `useFormat()` (`formatMoney`/`parseAmount`) — that's Issue 03 formatting-seam work landing early; harmless.
