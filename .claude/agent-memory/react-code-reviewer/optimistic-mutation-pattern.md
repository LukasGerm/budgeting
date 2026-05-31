---
name: optimistic-mutation-pattern
description: First optimistic mutation is useToggleCompletion in use-habits.ts; onMutate cancel+snapshot+setQueryData, onError rollback, onSettled invalidate; typed-updater gotcha
metadata:
  type: project
---

`useToggleCompletion` in `src/hooks/use-habits.ts` is the repo's FIRST optimistic mutation and the reference template for any future one. Shape: `onMutate` cancels in-flight `habit.list` queries (`cancelQueries(trpc.x.queryFilter())`), snapshots via `getQueryData(...queryKey())`, then `setQueryData(...queryKey(), updater)`; `onError` restores `ctx.prev`; `onSettled` invalidates to reconcile. Mutation key/fn use `trpc.habit.toggleCompletion.mutationKey()` + `trpcClient.habit.toggleCompletion.mutate(input)` (writes go through the vanilla client, reads through the `useTRPC()` options proxy — matches `use-expenses.ts`).

**Why:** Slice 5 of the habit tracker; taps must feel instant. The optimistic cache write returns a NEW array (`old.map(...)`), so `useHabits`'s `useMemo([rows, now])` retriggers and both cell state + streak flip immediately. `now` is loader-stable so only `rows` identity changes.

**How to apply:**
- Recurring gotcha to flag: a hand-written `old` parameter type on the `setQueryData` updater does NOT typecheck. `setQueryData`'s updater receives `T | undefined`; writing `(old: Array<{...; [key: string]: unknown }>) =>` fails `tsc` (TS2345) because (a) it omits `undefined` and (b) the index signature doesn't structurally match the real row type. Prefer letting the type infer — pass `trpc.habit.list.queryOptions().queryKey` / use the typed updater so `old` is correctly `Row[] | undefined`. The `if (!old) return old` runtime guard is right but doesn't satisfy the type.
- The project has NO standalone typecheck script (`build` = `vite build` esbuild transpile, `check` = biome, `test` = vitest). So `tsc` errors do NOT fail CI/build — you must run `pnpm exec tsc --noEmit` yourself during review to catch type holes. Biome passing is not sufficient.

Related: [[trpc-router-conventions]], [[habit-card-heatmap]], [[daykey-convention]].
