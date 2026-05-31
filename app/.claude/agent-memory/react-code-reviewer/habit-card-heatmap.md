---
name: habit-card-heatmap
description: HabitCard/HabitHeatmap/HabitStreakBadge render conventions — loader `now` → useHabits(now) useMemo derive, fit-to-width flex grid, role=img cells, output/status badge
metadata:
  type: project
---

Slice 4 habit-card rendering layer (reviewed clean 2026-05-30). Pattern to expect in future habit work:

**Data flow:** `_authed/habits.tsx` loader does `now = startOfDay(new Date())`, `ensureQueryData(habit.list)` inside `withLoginRedirect`, returns `{ now }`. Component reads `now` via `Route.useLoaderData()` and passes it to `useHabits(now)` AND `HabitCard now=`. Matches dashboard/home loader-`now` idiom. See [[trpc-router-conventions]], [[daykey-convention]].

**`useHabits(now)`** (`src/hooks/use-habits.ts`): `useSuspenseQuery(habit.list)` then derives `streak`/`heatmap` per habit in a `useMemo([rows, now])` — NOT in a tRPC `select` (select is keyed to data only, would go stale when `now` advances; the `now`-dependent math must live in the memo). Budget-agnostic by design (takes only `now`). Converts wire ISO `completionDays` → dayKeys via `isoDayToDayKey` before calling `currentStreak`/`buildHeatmap`.

**dayKey chain is consistent (no off-by-one):** server `list` emits ISO via `c.day.toISOString().slice(0,10)` (UTC parts — correct per @db.Date trap); `isoDayToDayKey("2025-03-09")` → `"2025-2-9"` (1-indexed→0-indexed month, unpadded, parsed as local); `buildHeatmap` cell keys + `dayKey(now)` today-detection all produce the same unpadded-local-0month format. Traced single-digit day — aligns. `buildHeatmap` future-detection uses `cellDate.getTime() > todayStart` (numeric), sidestepping the unpadded-string-ordering bug.

**HabitHeatmap** (`src/components/habits/habit-heatmap.tsx`): renders `weeks: HeatmapCell[][]` as `flex w-full gap-[2px]` with columns `flex min-w-0 flex-1 flex-col` and cells `aspect-square` — fit-to-width, no fixed px, cannot overflow at phone width. Outer + cells are `role="img"` with `aria-label`; cells carry `data-state` (done/missed/future), `data-today`, `title`. `done` cell uses inline `style={{ backgroundColor: color }}`; missed `bg-muted`; future `bg-muted/40`; today `ring-1 ring-foreground/60` regardless of state. Read-only divs in slice 4; slice 5 upgrades non-future cells to `<button>` (the `data-state` attr eases that). Column key is array index (biome-ignored, positional — acceptable); cell key is `cell.key` (stable dayKey).

**HabitStreakBadge** (`src/components/habits/habit-streak-badge.tsx`): `<output>` element (→ `role="status"`), Flame + `tabular-nums`, current streak only, ALWAYS shows incl. 0 (unlike StreakChip which hides 0 and has a popover). `aria-label` "Current streak: N day(s)" with singular/plural. Styled after `src/components/streak-chip.tsx`.

**Cosmetic-only (browser-check, not a code bug):** `HabitCard` overrides shadcn `CardHeader`'s default grid with `flex flex-row items-center`; the `Card`'s default `py-6` + `gap-6` still apply, so header/heatmap vertical rhythm is whatever those defaults give. Verify spacing visually rather than flagging in code review.

**Tests** mirror `src/components/dashboard/*.test.tsx`: `// @vitest-environment jsdom`, `afterEach` clears body, assert rendered DOM attrs (`data-state`, `data-today`, `title`, `aria-label`, column count via `gridEl.children`), not internals. Badge test queries `getByRole("status")`. Build fixtures via real `buildHeatmap(...)` + `dayKey(TODAY)` so test and component share the key format.
