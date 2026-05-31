---
name: trpc-router-conventions
description: How tRPC routers, their tests, and the read/write hook split are structured in this repo (src/integrations/trpc)
metadata:
  type: project
---

tRPC router + hook conventions (src/integrations/trpc/router.ts, src/hooks/use-*.ts).

**Router structure:** one `xRouter` object per namespace (`budgetRouter`, `expenseRouter`, `habitRouter`), each `satisfies TRPCRouterRecord`, all composed in `createTRPCRouter({ budget, expense, habit })`. Every procedure is `protectedProcedure` and pins `ctx.userId`. Reads return mapped wire shapes (never raw Prisma rows); ownership is enforced by pinning `userId` in `where` for reads and `updateMany`/`deleteMany` for writes (another user's id matches nothing = no-op, not an error).

**Procedure tests** (e.g. router.test.ts, habit-router.test.ts): Prisma mocked at the `#/db` boundary with `vi.fn()`s; `vi.mock("#/lib/auth", () => ({ auth: {} }))` to keep router import free of Better Auth/env side-effects; caller built via `trpcRouter.createCaller({ userId })`. Tests assert the exact `where`/`data`/`include` shapes handed to Prisma (the security boundary) plus null-caller rejection — NOT Prisma internals. This is the expected, validated test style; don't ask for more.

**Read hook pattern:** `useTRPC()` + `useSuspenseQuery(trpc.x.y.queryOptions(input, { select }))`. SSR-first: route `loader` calls `context.queryClient.ensureQueryData(context.trpc.x.y.queryOptions(...))` wrapped in `withLoginRedirect` (turns tRPC UNAUTHORIZED into a /login redirect). For a no-input query, loader `queryOptions()` and hook `queryOptions(undefined, opts)` produce the SAME query key — `select` does not affect the key — so the prefetched entry is hit. **Why:** server-rendered first paint, no loading flash.

**Write hook pattern:** TWO accepted variants, both fine. (1) `useMutation(trpc.x.y.mutationOptions({ onSuccess }))` (used by useUpdateExpense/useDeleteExpense). (2) Mixed: `useMutation({ mutationKey: trpc.x.y.mutationKey(), mutationFn: (i) => trpcClient.x.y.mutate(i), onSuccess })` — used by useAddExpense/useCreateHabit when the hook maps wire⇄domain at the boundary. `trpcClient` is the vanilla client from `#/integrations/tanstack-query/root-provider`. onSuccess invalidates the list via `queryClient.invalidateQueries(trpc.x.list.queryFilter())`.

**Server-never-computes-today:** local-day notions (cycle anchor, streak window) take a caller `now`/`day`; the loader computes `now` once via `startOfDay(new Date())` and passes it through verbatim so SSR + client key identically (re-deriving client-side breaks the key → hydration error). See [[daykey-convention]].
