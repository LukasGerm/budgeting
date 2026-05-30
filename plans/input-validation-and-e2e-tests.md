# PRD — Input Validation & Error Handling + Playwright E2E Suite

- **Status:** Planned (not started). Grilled & agreed 2026-05-30; no code written.
- **Owner:** Lukas
- **Scope:** Two related workstreams, deliverable independently. WS1 (validation) is a
  prerequisite only for WS2's "validation error" specs.

---

## 1. Problem statement

### WS1 — Input validation & error handling
The app accepts unbounded money amounts. `budget.set` validates
`monthlyAmountCents` as `z.number().int().nonnegative()` with **no upper bound**, but the
column is a Postgres `int4` (max `2,147,483,647` cents ≈ **€21.4M**). Set a budget above
that and the request sails past Zod and dies deep in Prisma with a raw, user-hostile
error, which `settings.tsx` renders verbatim via `e.message`. The same unbounded-integer
hole exists in `expense.add` and `expense.update` (`amountCents: z.number().int()`).

Error surfacing is also inconsistent:
- Onboarding / Settings forms: inline `<p role="alert">`, shows raw `e.message` on server failure.
- Keypad (spend) sheet: a generic `toast.error("Couldn't save that. Check your connection.")` that hides the real reason.
- Auth (login / signup): inline, via Better Auth's `result.error.message`.

And validation is **duplicated** — client forms re-check amount/anchor, the server re-checks
in inline Zod, and the two don't share a source, so they can drift.

### WS2 — End-to-end tests
There is **no E2E coverage at all** — no Playwright, no config, no `e2e/` dir. The only tests
are Node-only Vitest domain unit tests. There's no automated proof that a feature works from
the user's seat, and (post-WS1) no proof the new validation messages actually reach the user.

---

## 2. Goals / non-goals

**Goals**
- No raw Prisma / framework error ever reaches the user. Every rejected input shows a
  human-readable message.
- One source of truth for input limits and their messages, shared by server and client.
- A Playwright E2E suite covering every user-facing feature, runnable locally.

**Non-goals**
- No CI pipeline for E2E in this iteration (local tooling only).
- No change to the cycle/streak math or the data model.
- No re-architecting of auth; Better Auth's own error strings are acceptable as-is
  (its surface is in scope for messaging consistency but not for schema sharing).
- No test backdoors in production code (no clock override, no seed endpoint).

---

## 3. WS1 — Input validation & error handling

### 3.1 Decisions (locked)
| Decision | Choice |
|---|---|
| Approach | **Systematic** — shared Zod schemas + a single error-mapping layer; audit every input. |
| Limits | Monthly budget max **€1,000,000.00** (`100_000_000` cents); single spend/adjustment max **€100,000.00** (`10_000_000` cents). Min budget > €0; spend > €0; adjustment ≠ 0. |
| Surfacing | **Two-layer** — forms validate against the shared schema for instant inline field errors (no round trip for known limits); a central `getErrorMessage()` maps anything that still returns from the server. |
| Schema location | **Domain layer** (`src/domain/validation.ts`), exported via `domain/index.ts`, unit-tested. These are business rules; the domain is the shared, server+client-safe layer. |

### 3.2 Design

**`src/domain/validation.ts`** (new) — single source of truth:
- Constants: `MAX_BUDGET_CENTS = 100_000_000`, `MAX_ENTRY_CENTS = 10_000_000`,
  `MAX_NOTE_LENGTH = 280`, `MIN_ANCHOR_DAY = 1`, `MAX_ANCHOR_DAY = 31`.
- Schemas (each carries human-readable messages; e.g. `"Budget can be at most €1,000,000."`):
  - `budgetSetSchema` — `monthlyAmountCents` int, `> 0`, `<= MAX_BUDGET_CENTS`;
    `anchorDay` int in `[1, 31]`. (Tightens the server from `nonnegative` → `positive` to
    match the form, which already rejects €0.)
  - `expenseAddSchema` — `kind` enum default `"spend"`; `amountCents` int; spend must be
    `> 0`, adjustment must be `≠ 0`; `|amountCents| <= MAX_ENTRY_CENTS`; optional trimmed
    `note` capped at `MAX_NOTE_LENGTH`. Preserves the existing `superRefine` sign rules.
  - `expenseUpdateSchema` — `id` non-empty string; `amountCents` int, `≠ 0`,
    `|amountCents| <= MAX_ENTRY_CENTS`; optional trimmed note. (`kind` is immutable so absent;
    stored amount stays signed.)
- Limit messages derive the euro figure from the constant so copy can't drift from the cap.

**`src/integrations/trpc/init.ts`** — add a tRPC `errorFormatter` that attaches the raw
`ZodError.issues` to `error.data` (e.g. `data.zodIssues`), so a `.input()` rejection arrives
at the client as structured data, not a stringified blob.

**`src/integrations/trpc/router.ts`** — replace the three inline Zod inputs with the shared
schemas (`budget.set` → `budgetSetSchema`, `expense.add` → `expenseAddSchema`,
`expense.update` → `expenseUpdateSchema`). `z` import stays (`now` / `id` inputs on the
list/delete procedures). The server can then never pass an out-of-range int to Prisma.

**`src/lib/get-error-message.ts`** (new) — central mapper:
- `TRPCClientError` with `data.zodIssues` → the first issue's friendly `message`.
- Known tRPC codes (`UNAUTHORIZED`, etc.) → a friendly mapped string.
- Anything else → a generic safe fallback (`"Something went wrong. Please try again."`).
- Never returns a raw Prisma / stack / JSON string.

**Forms** (`routes/_authed/onboarding.tsx`, `routes/_authed/settings.tsx`):
- Keep the EUR-string parse at the UI edge (format errors stay client-side:
  `"Enter a valid amount in EUR (e.g. 300 or 1234,56)."`).
- Then run the **shared** `budgetSetSchema.safeParse({ monthlyAmountCents, anchorDay })`
  and surface the first issue message inline — instant, no round trip, identical copy to the
  server. Replaces the hand-rolled `> 0` / anchor checks.
- Route any thrown server error through `getErrorMessage`.

**`src/components/spend-sheet.tsx`** — `onError` → `toast.error(getErrorMessage(e))`
(specific message, replacing the blanket "Check your connection").

**`src/components/entry-form.tsx`** — cap the keypad magnitude at `MAX_ENTRY_CENTS` so the
amount can never be built past the limit (mirrors the inline-feedback principle).

### 3.3 Acceptance criteria
- Setting a budget of €2,000,000 shows `"Budget can be at most €1,000,000."` inline — no
  network call, no Prisma error.
- An entry over €100,000 is rejected with the friendly message at the form and at the server.
- The keypad cannot build an amount above €100,000.
- Server-thrown errors render via `getErrorMessage` everywhere; no raw string is ever shown.
- `domain/validation.test.ts` covers each schema's bounds, signs, and message copy; the suite
  is green; `pnpm check` passes.
- Manual verification in `pnpm dev` of the budget-too-high, entry-too-high, zero, and
  negative paths.

---

## 4. WS2 — Playwright end-to-end tests

### 4.1 Decisions (locked)
| Decision | Choice |
|---|---|
| Runner | `@playwright/test` (the real runner, not the MCP). |
| Backend | **Reuse the dev DB** (Postgres :5433). Isolate by unique signed-up users; no DB reset. *Risk accepted: leftover state across runs — mitigate by making every test self-isolate by its own user.* |
| Auth | **Hybrid** — one dedicated spec runs the real signup → onboarding → logout → login flow; every other spec reuses a pre-authenticated, already-onboarded user via a per-worker fixture (sign up a unique user, save `storageState`, reuse). |
| Time | **Time-agnostic** — assert deltas / presence / ratios, never absolute dates. Multi-day streak accrual & cycle rollover stay covered by the domain unit tests. No clock faking, no backdated-seed backdoor. |
| Runtime | **No `webServer`** — tests hit `http://localhost:3000`; precondition: `pnpm dev` is already running against the dev DB. Local tooling, not CI. |

### 4.2 Infrastructure
- Install `@playwright/test` + browsers; add `playwright.config.ts` (`baseURL`, no `webServer`,
  sensible timeouts/retries). Add an `e2e/` dir and a `pnpm e2e` script.
- Per-worker **auth fixture**: signs up a uniquely-named user, completes onboarding once,
  saves `storageState`, and hands authenticated pages to that worker's specs.
- A small helper for unique emails (e.g. worker-index + run-stamp passed in, since
  `Date.now()` determinism isn't required here — uniqueness is).
- Document the precondition (server running, pointed at dev DB) in `e2e/README.md`.

### 4.3 Spec inventory (every feature)
1. **Auth flow** — real signup → onboarding → logout → login (the one un-fixtured spec).
2. **Onboarding** — set initial budget + anchor day; redirect to home.
3. **Home / add spend** — keypad add; entry appears; "spent today" / remaining update by the delta.
4. **Adjustments** — top-up (raises available) and set-aside (lowers available).
5. **History — edit** — change an entry's amount + note; numbers recompute.
6. **History — delete** — confirm dialog; entry removed; numbers recompute.
7. **Settings** — edit budget, edit anchor day, logout.
8. **Validation errors** *(ties to WS1)* — €2,000,000 budget → friendly inline message, no raw
   Prisma; over-limit / invalid entry amounts blocked with the friendly message.
9. **Undo toast** — after add, the undo toast appears; Undo removes the entry and reverts numbers.
10. **Streak chip (today surface)** — chip renders / reflects today's activity after a spend.
11. **Empty / redirect / 404** — no-budget → onboarding redirect; empty-history state; not-found route.

### 4.4 Acceptance criteria
- `pnpm e2e` (with `pnpm dev` running) passes all specs locally.
- Each spec is self-isolating (own user) and parallel-safe.
- Specs assert observable user-facing outcomes, written against the live DOM (real selectors),
  not implementation details.
- Spec #8 fails if WS1 regresses (a raw Prisma error or missing message).

---

## 5. Execution notes
- **Driven directly & sequentially** (no multi-agent workflow): Playwright specs only pass if
  authored against the live app, and per the repo rule the app must be run to verify.
- Suggested order: WS1 end-to-end (incl. manual browser verification) → WS2 infra + fixture +
  one reference spec → remaining specs.
- Convention reminders (AGENTS.md / CLAUDE.md): shadcn-only UI, Biome (tabs, double quotes),
  `#/...` import alias, SSR-first data via loaders + TanStack Query, avoid `useEffect`.

## 6. Open questions / risks
- **Dev-DB pollution:** reusing the dev DB means each run leaves orphaned test users. Acceptable
  for now; revisit a dedicated `budgeting_test` DB if it gets noisy.
- **Auth-flow flakiness:** the un-fixtured signup spec is the slowest/most fragile; keep it
  minimal and rely on the fixture for everything else.
- **Locale in messages:** limit copy uses a leading `€` (English style) while amounts elsewhere
  format `de-DE` (`1.000.000,00 €`). Confirm that's acceptable or unify later.
