---
name: verify-accounts-and-seeding
description: Working dev test accounts and the exact UI flow to seed a budget, spends, and adjustments for verification
metadata:
  type: project
---

Throwaway dev accounts for browser verification (email+password auth, sign up via the running app — documented workflow, never ask the user). All on localhost:3000.

- `dashtest@example.com` / `Test1234!` — working creds, budget 900 €, anchor day 1. NOTE: cycle data has DRIFTED from the original seed across runs. As of 2026-05-30 latest run the current cycle held 4 SPENDs = 207,00 € (1400/14200/700/4400 cents) plus a TOPUP:2000 I added — so spend-only = 207,00 €, net "left this cycle" = 713 €. DO NOT assume the 51,55 € figures; always recompute spend-only from the live ledger (see [[dashboard-route-ssr]] for the listForCurrentCycle fetch). Session was already authenticated in the existing "Budgeting" tab (no login needed this run).
- `verify-slice2@example.com` / `test-password-123` — older account from user memory [[local-dev-setup]]; has junk data (budget 30 €, anchor 10, a 20.735 € entry). Avoid for clean checks.
- `habits-e2e@example.com` / `HabitsTest123!` — created 2026-05-31 for full Habit-Tracker e2e. Budget 500 €, anchor day 1. Has habits "Reading" (brain icon, coral) + "Workout" (dumbbell, amber), both with a couple completions. NOT a clean empty state anymore — for a fresh empty-state/first-habit check, sign up a NEW email. Logout-before-signup gotcha applies (see below).

**Signup-form timing gotcha (2026-05-31):** the FIRST fill+submit after a fresh navigate to `/signup` sometimes silently resets the fields without submitting (no inline error, no console error, no redirect). Re-fill by clicking the field by COORDINATE (not just ref), verify both fields show values via screenshot, THEN click Sign up — the second attempt goes through to `/onboarding`. The Settings "Log out" button DOES work reliably by coordinate (lands on `/login`); click it, wait ~1.5s, confirm URL is `/login` before navigating to `/signup`.

**GOTCHA — signing up / logging in while already authenticated:** `/signup` and `/login` redirect authenticated users straight to `/` (the form looks like it submitted but you just bounced Home, still on the OLD account). Log out first. Reliable logout: in-page `fetch('/api/auth/sign-out',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'})` → 200, then navigate to `/signup`. (Settings has a "Log out" button too but its read_page ref drifts; the server fetch is deterministic.)

**Seeding flow (all via UI):**
1. Log out if a session exists. `/signup` has exactly TWO fields — **Email** (`type=email`,`name=email`) + **Password** (`type=password`,`name=password`) — and a "Sign up" button. NO name field. On success → auto-redirect to `/onboarding`.
2. `/onboarding` ("Set up your budget"): "Monthly budget (EUR)" (text input, ph "e.g. 300", empty) + "Cycle starts on day" (number, defaults to 1). Fill budget with real keystrokes (click → cmd+a → type "900"). Submit button = **"Save and continue"** → lands on Home `/` ("Hi, <email>", "900,00 € left of 900,00 €").
3. Add entries via the **"Log a spend" FAB** (blue + button, bottom-right) — ICON-ONLY (`aria-label="Log a spend"`, empty textContent). Open via `[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Log a spend').click()`.
4. The entry sheet is a **NUMERIC KEYPAD**, not text inputs (the `[role=dialog]` has NO `<input>`s):
   - Top toggle: **Spend / Adjust** (Spend on by default).
   - Amount via on-screen keypad buttons: digits by `textContent` ('0'..'9'), decimal = the **comma** button (textContent ','), backspace = `aria-label="Delete"`. Display shows e.g. "12,50 €".
   - Spend submit = icon button `aria-label="Add spend"`.
   - For an adjustment: click **Adjust**, then a sub-toggle **"Set aside (-)" / "Top up (+)"** appears (these have textContent). Pick "Top up (+)" (display shows "+ 0,00 €"), enter digits in a SEPARATE call (mode switch re-renders & discards keypad input), submit = `aria-label="Add adjustment"`.
   - Note is the optional "Add a note" button (skippable; doesn't affect spend math).
   - Sheet closes on submit; Home RECENT + "Available today" + "left this cycle" update live (no reload). Spends show plain (e.g. "12,50 €"), top-ups show "+ 20,00 €".
5. **Top-up = adjustment.** After the 20 € top-up: Home "left this cycle" 848,45 → 868,45 (net counts it); the Dashboard "Spent this cycle" stays 51,55 € (spend-only). That's the net-vs-SPEND split.
