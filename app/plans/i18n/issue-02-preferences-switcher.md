# Issue 02 — Preference persistence + language/currency switcher

**Type:** AFK

## Parent

`plans/i18n/prd.md`

## What to build

Make language and currency real, persisted, per-user preferences with an instant
in-app switcher.

- Add **`language` + `currency`** to the user via **Better Auth `additionalFields`**;
  Prisma migration with safe defaults (`language='en'`, `currency='EUR'`) so existing
  rows are unaffected.
- Wire the preference into the resolver's top-precedence slot: an authed user's stored
  values win over the cookie. Seed/refresh the **cookie from the DB on login**.
- Build the **`user.setPreferences`** tRPC mutation (Module G): writes the DB columns,
  sets the cookie, and ensures the Better Auth session reflects the new value.
- Settings UI (Module I): a **language `Select` (DE/EN)** and a **currency `Select`
  (EUR/USD/GBP/CHF)**. On change: **instant `i18n.activate`** + re-render with no flash,
  currency reformatting applied live, and persistence (DB + cookie) in the background.

## Acceptance criteria

- [ ] A logged-in user can switch language in Settings and the UI updates **instantly** (no reload, no flash).
- [ ] A logged-in user can switch currency in Settings and all visible amounts re-render with the new symbol/format **without converting** the underlying numbers.
- [ ] The choice **persists across reload** and is **synced across devices** (stored on the account, not just the cookie).
- [ ] On the next hard navigation, the **server-rendered first paint** already uses the persisted language + currency (cookie seeded from DB).
- [ ] Existing accounts (no prior preference) default to `en`/EUR and continue to work.
- [ ] tRPC test for `user.setPreferences` (persists language+currency, reflected on subsequent read) passes; `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test` green.

## Blocked by

- Issue 01 (i18n foundation + format/parse module).
