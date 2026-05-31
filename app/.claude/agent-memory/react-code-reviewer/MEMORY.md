# Memory Index

- [Money domain object](money-domain.md) — all currency is integer cents; `Money` in src/domain/money.ts is the only currency type; format at the UI edge via `.format()`
- [Dashboard charts](dashboard-charts.md) — Recharts charts under src/components/dashboard; SSR mount-gate idiom; YAxis conventions per chart; co-located formatters
- [dayKey convention](daykey-convention.md) — dayKey is non-zero-padded local Y-(0month)-D; equality OK, ordering with </> is a BUG; @db.Date UTC-midnight round-trip trap
- [_authed chrome layout](authed-chrome-layout.md) — sticky top app-bar (Settings gear) + fixed BottomNav (Home·Dashboard·History·Habits); page bodies own header in shared max-w-md container; onboarding chrome-free
- [tRPC router conventions](trpc-router-conventions.md) — router/test structure, SSR loader+useSuspenseQuery read hooks, two accepted write-hook variants, ownership via where-pinned userId
- [Sheet component pattern](sheet-component-pattern.md) — vaul Drawer create/edit forms (SpendSheet/HabitSheet); FAB trigger, reset-on-close, submit guards, local-state ≤3 rule, icon ToggleGroup
- [Habit card + heatmap](habit-card-heatmap.md) — loader `now`→useHabits useMemo derive (not select); fit-to-width flex grid, role=img cells w/ data-state/today; output/status streak badge always-shows-0
- [Optimistic mutation pattern](optimistic-mutation-pattern.md) — useToggleCompletion is repo's first; cancel/snapshot/setQueryData/rollback/invalidate; setQueryData updater typing gotcha; NO typecheck in CI — run tsc yourself
- [Today checklist surface](today-checklist-surface.md) — slice 6 presentational TodayChecklist; checklist↔heatmap "can't disagree" sync invariant + how to verify; ui/ is Biome-ignored (don't flag shadcn 2-space)
