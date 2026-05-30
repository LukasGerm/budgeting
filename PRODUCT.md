# Budgeting — Product Definition (MVP)

## Problem Statement

I have a monthly budget but no way to feel it in the moment. I see a big number on the 1st, spend freely for two weeks, and find out only on the 20th that I've blown through it. Tracking apps that ask me to categorise every coffee are too heavy for the actual question I need answered at the till: *can I afford this, right now, today?*

## Solution

A mobile-first PWA that collapses the budgeting question into a single number: **how much can I spend today.** That number is recomputed continuously from my monthly budget, the day of the cycle, and what I've already spent. Logging a new expense is a two-second action behind one button. If I overspend, the number goes negative and stays negative — no shaming copy, no encouragement, just an honest figure I have to look at every time I open the app.

The app installs to the home screen, works offline, and syncs back to a server when it can — but it never asks me to wait for the network to log a coffee.

## User Stories

### Onboarding & account

1. As a new user, I want to sign up with email and password, so that my data persists across reinstalls and devices.
2. As a returning user, I want to log in with email and password, so that I can pick up where I left off.
3. As a new user, I want to set my monthly budget amount in EUR during onboarding, so that the app can calculate my daily allowance.
4. As a new user, I want to choose which day of the month my budget cycle starts on (1–31), so that the cycle aligns with when I get paid or when I mentally reset.
5. As a new user whose anchor day doesn't exist in a given month (e.g. 31st in February), I want the cycle to start on the last day of that month instead, so that I never have a missed cycle.
6. As a new user, I want my first cycle to be the one already in progress relative to my anchor day, so that I can start tracking immediately without waiting up to a month.
7. As a logged-in user, I want to log out from settings, so that I can hand my phone to someone without exposing my data.

### The home screen (primary loop)

8. As a user, I want to open the app and see, as the single most prominent number, how much money I can spend today, so that I get my answer in under a second.
9. As a user, I want to see, secondary to the daily number, how much I have left for the entire current cycle and what day of the cycle I'm on, so that I have context for the daily figure.
10. As a user, I want the daily number to go up the next morning if I underspent today, so that saving feels rewarding.
11. As a user, I want the daily number to go down (and turn red, even go negative) if I overspent, so that I face the consequence of yesterday's spending the moment I open the app.
12. As a user, I want to see my last few expenses on the home screen, so that I can verify the number without navigating away.

### Logging a spend

13. As a user, I want a thumb-reachable button on the home screen labelled to invite logging a spend, so that the action takes one tap from cold-open.
14. As a user, I want a numeric keypad (not the OS keyboard) to enter the amount, so that I'm not fighting autocorrect or scrolling for a decimal point.
15. As a user, I want to optionally add a short text note to a spend, so that I can later remember what an expense was without being forced to categorise it.
16. As a user, I want to confirm a spend with a single large button, so that I can complete the flow without precision-tapping.
17. As a user, I want the daily and monthly numbers to update immediately after logging, so that the consequence of my purchase is visible before I put my phone away.
18. As a user, I want an "undo" affordance to appear for a few seconds after logging, so that I can instantly correct a typo (e.g. 200 instead of 20) without going to history.
19. As a user, I want logging a spend to succeed instantly even when I have no internet, so that I can use the app at a till with no signal.

### History

20. As a user, I want a history screen listing every expense in the current cycle (amount, optional note, relative date), so that I can audit the daily number.
21. As a user, I want to delete an old expense from history with a confirmation step, so that I can fix mistakes I noticed too late for the undo toast.
22. As a user, I want the daily and monthly numbers to recompute after I delete an expense, so that history edits are reflected immediately.

### Settings

23. As a user, I want to change my monthly budget amount from settings, so that I can react to a raise, a pay cut, or a lifestyle change.
24. As a user, I want a change to my budget amount to apply retroactively to the current cycle, so that the home number reflects my new reality immediately rather than at the next anchor.
25. As a user, I want to change my anchor day from settings, so that I can re-align the cycle if I switch employers or rethink my mental month.

### Cycle rollover

26. As a user, I want the app to automatically start a new cycle on my anchor day with the full budget restored to zero spent, so that I never have to do bookkeeping.
27. As a user, I want any overspend from the previous cycle to *not* carry into the new cycle, so that one bad month doesn't doom the next one.
28. As a user, I want any underspend from the previous cycle to *not* carry into the new cycle either, so that the rule is symmetric and predictable.

### PWA & offline

29. As a user, I want to install the app to my home screen on iOS, so that it feels like a native app and I don't have to find a browser tab.
30. As a user, I want the app to open and show my last-known numbers when I'm fully offline, so that the home screen is never blank.
31. As a user, I want changes I make offline (logging, deleting) to be pushed to the server automatically when I'm back online, so that my data ends up safe without me thinking about it.
32. As a user, I want the app to pull the latest server state when I open it online, so that if anything got synced from elsewhere, I see it.

### Negative-balance feedback

33. As a user, I want the daily number to be displayed in red when it is negative, so that the overspent state is unmistakable at a glance.
34. As a user, I want the monthly line to read e.g. "−47 € over budget" in red when the cycle total has flipped, so that I understand the magnitude of the deficit.

## Implementation Decisions

### The math

- **Daily available formula** (pure, recomputed on every render):
  `available_today = (elapsed_days_in_cycle × monthly_budget) ÷ total_days_in_cycle − total_spent_in_cycle`
- Both `elapsed_days_in_cycle` and `total_days_in_cycle` are derived from the current cycle bounds, themselves derived from the anchor day and the current local date.
- The daily number is allowed to be negative. No clamping.
- Hard reset between cycles: neither overspend nor underspend carries over.
- Mid-cycle budget changes apply retroactively — the formula simply re-reads the current budget value. There is no historical budget table.

### Cycle definition

- A cycle is `[anchor_day_of_month, next_anchor_day_of_month)`.
- If the anchor day does not exist in a given month (e.g. anchor = 31, month = February), the cycle starts on the last day of that month instead. The next cycle starts on the actual anchor day if it exists, otherwise the last day of that month.
- `total_days_in_cycle` is therefore variable (28 to 31). The daily rate naturally adjusts; long months do not grant more money.
- The first cycle after signup is the one currently in progress, backdated to the most recent anchor day at or before signup date.

### Architecture — SOLID at genuine seams only

A four-layer structure, with dependencies pointing only inward (App → Ports → Domain; Adapters → Ports → Domain):

1. **Domain** — pure value objects and pure functions. Imports nothing from React, Prisma, tRPC, IndexedDB, or any I/O. Contains: `Money` (integer cents), `Cycle`, `Expense`, `Budget`, plus the calculation functions `getCurrentCycle(now, anchorDay)`, `calculateAvailableToday(budget, expenses, now)`, `calculateMonthlyRemaining(budget, expenses)`.
2. **Ports** — interfaces named after *what they do*, not how: `Clock`, `ExpenseRepository`, `BudgetRepository`.
3. **Adapters** — concrete implementations of the ports: `SystemClock`; `LocalExpenseRepository` and `LocalBudgetRepository` over `@tanstack/react-db` / IndexedDB; `RemoteExpenseRepository` and `RemoteBudgetRepository` over tRPC + Prisma; a `SyncingExpenseRepository` and `SyncingBudgetRepository` that compose local + remote and handle the LWW push/pull queue.
4. **App** — TanStack Router routes, React components, and hooks. Depends on ports only; never imports adapters directly. A small DI layer (React context provider) injects the concrete adapters at the root.

Things explicitly **not** abstracted (single implementation, no genuine variability): the sync transport itself (always tRPC), auth (Better Auth provides its own abstraction), the formula (pure function — already abstract). Adding interfaces here would be SOLID-cosplay.

### Data model

- **User** — managed by Better Auth (email + password, no verification, no reset for MVP).
- **Budget** — one record per user: `monthlyAmount` (integer cents), `anchorDay` (1–31), `updatedAt`. Single row, updated in place; no history.
- **Expense** — many per user: `id`, `userId`, `kind` (`spend` | `adjustment`), `amount` (integer cents; positive for a spend, signed for an adjustment), `note` (optional string), `createdAt` (timestamp set at submission time, never editable), `updatedAt` (records in-place edits to amount/note).
- Money is stored as integer cents everywhere (DB, domain, wire) and only formatted to a decimal string at the UI edge.

### Sync model

- Source of truth is the local store while the app is open; the server is the canonical record at rest.
- On each local write (add expense, delete expense, update budget), the write is applied locally first, then enqueued for the server.
- A push runs whenever the network is available; failures retry with backoff.
- On app open and on window focus while online, the app pulls the server state and reconciles via last-write-wins (by `updatedAt` for budget; expenses are append-only, deletes are tombstones).
- The MVP explicitly assumes a single device per user. Multi-device write conflicts are accepted as last-writer-wins with no merge UI.

### Screens & navigation

- **Onboarding** — three steps after signup: budget amount, anchor day, done. No skip.
- **Home** — greeting + date (small); daily available (huge, colour-shifted); monthly remaining + cycle position (medium one-liner); 2–3 most recent expenses; FAB pinned bottom-right.
- **Spend sheet** — bottom sheet over Home: custom numeric keypad, amount display, collapsed optional note field, "Log" button. Closes on submit; undo toast appears on Home.
- **History** — chronological list of expenses *in the current cycle only*. Tap to delete (with confirm). No filters, no search, no totals beyond what Home already shows.
- **Settings** — budget amount, anchor day, logout. Nothing else.
- **Bottom nav** — Home / History / Settings.

### PWA specifics

- Web app manifest with iOS-compatible icon set; `display: standalone`.
- Service worker caches the app shell for offline cold-start.
- Local data lives in IndexedDB via `@tanstack/react-db`, not in service worker cache.
- iOS Safari's ~7-day storage eviction is an accepted MVP limitation; cross-device safety comes from the server sync.

### Other locked decisions

- **Currency** — EUR only, hardcoded. No FX, no per-user setting.
- **Timezone** — device local; the day boundary is local midnight; the server does not compute "today."
- **Negative styling** — colour change to red on the daily number; sign-prefixed text ("−47 €") on the monthly line. No exclamation marks, no scolding copy.

### Reversed decisions (QoL, adjustments, streaks)

These three decisions reverse positions taken above/in *Out of Scope*. They are
recorded here explicitly rather than left as silent drift (see
`plans/2026-05-30-qol-and-streaks.md`).

- **A logged entry's amount and note are editable.** Logging is no longer
  append-only: tapping a history row reopens the keypad sheet pre-filled, and
  amount/note can be corrected in place after the undo toast is gone (delete
  becomes a secondary action inside that sheet). The no-backdating rule still
  holds — `createdAt` is never editable, so an entry never moves between cycles.
- **One-off cycle adjustments are allowed.** A top-up (reimbursement, cash gift)
  or set-aside (wall money off) nudges the *current cycle's* available pool in
  full, immediately. Adjustments are entries on the "spent" side of the formula
  (a top-up is a negative adjustment, a set-aside a positive one), so they are
  cycle-scoped and hard-reset at the anchor like spends. This is **not** income
  tracking or recurring entries — those stay in Finanzguru and out of scope.
- **Restraint is reflected back, quietly.** "No encouragement, just an honest
  figure" is relaxed to allow a deliberately understated streak: a quiet header
  chip headlines an under-rate streak (days at or below that day's daily rate),
  with current + best for both it and a stricter no-spend streak behind a tap.
  It never celebrates (no confetti, milestones, or copy) and a broken streak
  resets silently to 0, preserving the honest-figure spirit.

## Testing Decisions

A good test for this app exercises **external behaviour** of a module — given inputs, what outputs come out — and is invariant to how the module is implemented. Tests must not assert on private state, internal call counts, or render structure. Vitest is already configured; this is the project's first set of tests.

### Modules to test

- **Domain — calculation functions** (highest value). These are the load-bearing math of the entire product, they are pure, and they are trivial to test exhaustively.
  - `getCurrentCycle(now, anchorDay)` — including the short-month fallback (anchor 31 in Feb), the boundary case where `now` is exactly the anchor, and across DST transitions in the local timezone.
  - `calculateAvailableToday(budget, expenses, now)` — the formula, including day 1, the last day of a cycle, the negative case, the zero-spend case, the underspend rollover case across day boundaries, and a mid-cycle budget change reflected immediately.
  - `calculateMonthlyRemaining(budget, expenses)` — straightforward sum, but include the negative case and the empty case.
  - All of the above are tested with a fake `Clock` implementation so dates are deterministic.
- **Domain — value objects.**
  - `Money` arithmetic on integer cents — adding, subtracting, formatting; no floating-point drift across many small additions.
- **Adapters — `SyncingExpenseRepository`** (integration-level).
  - With an in-memory `LocalExpenseRepository` and a mock `RemoteExpenseRepository`, assert: writes are visible locally before the network call; failed pushes are retried; pulls reconcile remote-only records into local; deletes propagate as tombstones; offline writes drain to the server in order when network returns.

### Prior art

The project is freshly scaffolded; there are no existing tests to mirror. Vitest + `@testing-library/react` + `jsdom` are wired in `package.json` and ready to use. The first test file should establish the convention: `*.test.ts` co-located next to the module under test, no test-utility hierarchy until there is one needed by ≥3 files.

### Not worth testing for MVP

- React components and routes (covered implicitly by manual PWA walkthroughs; brittle to refactors).
- tRPC procedure plumbing (thin glue over Prisma; if Prisma works, this works).
- Better Auth handlers (vendor-owned).

## Out of Scope

The following are **explicitly not** in MVP. Each is a reasonable future addition; none should be smuggled in.

- Expense categories, tags, or any structured classification beyond the free-text note.
- Analytics, charts, monthly summaries, or "where did my money go" views.
- Multi-currency, FX, or any per-user currency setting.
- Multi-user / household / shared budgets, invite flows, attribution.
- Multiple budgets per user (e.g. "personal" + "vacation fund").
- Recurring expenses, scheduled expenses, income tracking, savings goals. (One-off, cycle-scoped *adjustments* are now in scope — see "Reversed decisions" — but recurring/scheduled/income tracking remain out.)
- Backdating an expense or editing its `createdAt`. (Editing the amount or note of an existing entry is now in scope — see "Reversed decisions" — but the day is still never editable.)
- Viewing historical cycles (history is current-cycle only).
- Multi-device conflict resolution beyond last-writer-wins; no merge UI.
- Push notifications, reminders, end-of-day or end-of-cycle summaries.
- Email verification, password reset, social login, 2FA.
- Importing transactions from a bank or CSV.
- Native iOS / Android apps; the product is a PWA.
- Internationalisation; copy is English-only, currency is EUR-only.

## Further Notes

- **Why "punish me" as a default.** The user explicitly chose pure rolling allowance and hard month-reset. The combination is intentional: within a cycle, every euro of overspend is visible and persistent; between cycles, the slate is wiped. This is the smallest design that creates real-time accountability without compounding shame across months.
- **Why no categories.** The product answers *"can I afford this today?"*, not *"where did my money go?"* The latter is a different product (YNAB, Lunch Money) and a much larger build. The optional free-text note exists as a release valve so users can audit their own numbers without forcing structure.
- **Why offline-first is in MVP scope.** The primary action — logging a spend — happens at tills and parking meters, places with bad signal. A version where the button can fail teaches users not to trust it. Building the LWW sync once at the start is dramatically cheaper than retrofitting it after users have learned the workarounds.
- **iOS PWA storage caveat.** Safari evicts PWA storage if the app is unused for ~7 days. This is accepted: the server sync is the safety net. Document this in the app's settings/about screen once that exists.

## Known limitations (MVP)

- **Offline navigation to Settings.** With the app open offline, the Home, History, and "log a spend" flows all work from the local store, and in-app navigation to History works. Navigating to the **Settings** tab while offline currently falls back to rendering the Home screen rather than the settings form (the Settings route does not resolve offline the way History does). Editing the budget/anchor therefore requires being online. The critical offline path — viewing today's number and logging spends — is unaffected. Revisit as a service-worker / route-resolution refinement post-MVP.
