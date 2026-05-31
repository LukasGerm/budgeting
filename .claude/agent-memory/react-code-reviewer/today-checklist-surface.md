---
name: today-checklist-surface
description: TodayChecklist (slice 6) — presentational top-of-tab logging surface; the checklist↔heatmap "two surfaces can't disagree" sync invariant and how to verify it
metadata:
  type: project
---

Slice 6 Today checklist (reviewed clean 2026-05-30). `src/components/habits/today-checklist.tsx`.

**Presentational purity:** `TodayChecklist` has NO hooks/state/effects — renders strictly from props `{ habits: HabitWithStats[]; onToggleToday: (habitId, currentlyDone) => void }`. The mutation (`useToggleCompletion`) lives in `_authed/habits.tsx`, which passes the wired callback. So its test needs no providers (mirrors dashboard tests). Expect the same shape for any future "quick-action" surfaces — keep the hook in the page, pass a flipped-intent callback down.

**Callback contract:** `onToggleToday(id, currentlyDone)` — child passes the CURRENT state; the PAGE flips it (`done: !currentlyDone`). Same shape as HabitHeatmap's `onToggleDay(isoDay, currentlyDone)`. When reviewing, confirm the page does the `!` flip, not the component.

**The sync invariant (core requirement — "two surfaces can't disagree"):** checklist row checkbox and heatmap today-cell are the SAME action. Verified-consistent chain:
- Both send the IDENTICAL `day` string: checklist sends `localDateToIsoDay(now)`; heatmap today cell sends `localDateToIsoDay(cell.date)`, and `buildHeatmap` builds the today cell's `date` from `now`'s y/m/d parts → both reduce to the same local Y-M-D. No ISO/date-vs-now divergence.
- Both hit the SAME `trpc.habit.list` cache via the SAME `useToggleCompletion` ([[optimistic-mutation-pattern]]).
- `todayDone = row.completionDays.includes(localDateToIsoDay(now))` (derived in `useHabits`'s `useMemo([rows,now])`, NOT a select/effect). The heatmap's today `done` state is `done.has(dayKey(cellDate))` from the same `completionDays`. One array, one memo → both recompute together after either optimistic write.
To re-verify in future changes: check (a) the page sends `day: localDateToIsoDay(now)`, (b) `todayDone` still derives from the same `completionDays` the heatmap uses, (c) no new `select` or second source for done-state. See [[habit-card-heatmap]] for the dayKey/ISO format chain, [[daykey-convention]].

**Test gap to know:** no test pins "checklist mutate payload == heatmap mutate payload" (the flip logic lives in the page, outside the component unit test). Non-blocking, but a page/integration test asserting both callbacks produce identical `toggle.mutate` args would lock the invariant.

**checkbox.tsx:** `src/components/ui/` is Biome-IGNORED (`biome check` reports "paths were provided but ignored"). So shadcn primitives there keep 2-space/CLI formatting — do NOT flag their non-tab indentation as a convention violation. Standard shadcn Checkbox imports from `radix-ui`, uses `data-slot`, renders `role="checkbox"` with `data-state=checked|unchecked`.
