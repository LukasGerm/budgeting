# Memory Index

- [Money domain object](money-domain.md) — all currency is integer cents; `Money` in src/domain/money.ts is the only currency type; since i18n, format at UI edge via `useFormat().formatMoney(x.toCents())` (Money.format() removed)
- [i18n foundation](i18n-foundation.md) — Lingui v6 modules (src/i18n/), SSR hydration-parity via root loader getResolvedPrefs, useFormat() seam, rolldown-babel macro wiring, deferred de-DE date sites
- [i18n preferences switcher](i18n-preferences-switcher.md) — Issue 02: client-stateful I18nSetupProvider, setPreferences→html lang imperative, user.setPreferences tRPC+cookies, no auth cookie-cache, biome glob gotcha, double session read
- [i18n formatting seam](i18n-formatting-seam.md) — Issue 03: useFormat() at component edge, no Money.format(), Module E domain copy-builders return structured unions, settings key-remount replaced useEffect (locale-omitted-from-key gap)
- [i18n translate core app](i18n-translate-core-app.md) — Issue 04: lingui CLI silent no-op (import.meta.main on Node 22.15), English-word-passthrough trap (vs-last-delta {dirSpan}), de-test gap blesses it, renderWithI18n test-utils, blessed patterns
- [i18n translate auth/onboarding/settings](i18n-translate-auth-onboarding-settings.md) — Issue 05: cross-link single-wrap `<Trans>`/`<0>` pattern, locale-aware validation separator, currency-name Select labels left half-raw (English words won't flip)
- [i18n localized errors](i18n-localized-errors.md) — Issue 06 Module H: pure error-codes.ts, errorFormatter→data.appErrorCode, useErrorMessage map; verified zod-v4/tRPC-cause/Better-Auth `result.error.code` runtime chains; history.tsx edit/delete has no onError (gap); no router-code↔catalog contract test
- [Dashboard charts](dashboard-charts.md) — Recharts charts under src/components/dashboard; SSR mount-gate idiom; YAxis conventions per chart; co-located formatters
- [dayKey convention](daykey-convention.md) — dayKey is non-zero-padded local Y-(0month)-D; equality OK, ordering with </> is a BUG; @db.Date UTC-midnight round-trip trap
- [_authed chrome layout](authed-chrome-layout.md) — sticky top app-bar (Settings gear) + fixed BottomNav (Home·Dashboard·History·Habits); page bodies own header in shared max-w-md container; onboarding chrome-free
- [tRPC router conventions](trpc-router-conventions.md) — router/test structure, SSR loader+useSuspenseQuery read hooks, two accepted write-hook variants, ownership via where-pinned userId
- [Sheet component pattern](sheet-component-pattern.md) — vaul Drawer create/edit forms (SpendSheet/HabitSheet); FAB trigger, reset-on-close, submit guards, local-state ≤3 rule, icon ToggleGroup
- [Habit card + heatmap](habit-card-heatmap.md) — loader `now`→useHabits useMemo derive (not select); fit-to-width flex grid, role=img cells w/ data-state/today; output/status streak badge always-shows-0
- [Optimistic mutation pattern](optimistic-mutation-pattern.md) — useToggleCompletion is repo's first; cancel/snapshot/setQueryData/rollback/invalidate; setQueryData updater typing gotcha; NO typecheck in CI — run tsc yourself
- [Today checklist surface](today-checklist-surface.md) — slice 6 presentational TodayChecklist; checklist↔heatmap "can't disagree" sync invariant + how to verify; ui/ is Biome-ignored (don't flag shadcn 2-space)
