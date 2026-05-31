---
name: i18n-switcher-persistence
description: i18n Settings language/currency switcher — instant client switch + DB persistence + cross-device SSR all VERIFIED PASS (2026-05-31 re-check); curl/DB verify recipe + Radix Select quirk
metadata:
  type: project
---

Issue 02–07 i18n verified 2026-05-31, account `habits-e2e@example.com` / `HabitsTest123!` (seed budget 3000 €, 4 expenses incl. a 1234,56 € spend for thousands-sep + a 200 € top-up, 2 habits). The Settings switcher (`Sprache & Währung` card) flips language + currency **instantly client-side** (no reload/flash) — that part is solid across every surface (home/dashboard/history/habits/settings + pre-auth login/signup), pluralization, locale date/number formats, localized errors, SSR first paint + `<html lang>`, clean console (no #418).

**PERSISTENCE NOW FIXED — re-verified PASS 2026-05-31** (both original defects resolved):
1. The stale-Prisma-client 500 is gone after the dev-server restart with a fresh generated client — `setPreferences` returns HTTP 200 `{json:null}` for both `{currency}` and `{language}`.
2. The `locale`→`language` key mismatch is fixed (mapped at the mutation boundary), so language now writes through. Verified: a UI switch to English persisted DB `language:en`, a curl switch to `de` persisted `language:de`. Currency persists too (`USD`).
3. **Cross-device now WORKS:** a fresh session/cookie jar (no `locale` cookie) SSR-renders the account's saved choice (`lang="de"`, German nav, USD money) — read from the DB user row, not the cookie. This was the only previously-failing criterion.

**Historical (the original two defects, now fixed — kept for context):** (a) running dev server held a stale Prisma client whose `user.update` 500'd on `language`/`currency` even though on-disk client/columns had them → a dev-server restart after `pnpm db:generate` clears it; persist is fire-and-forget so the client UI flipped anyway. (b) Settings sent `setPreferences({ locale })` to a mutation whose zod input only took `{ language, currency }` → `locale` silently dropped, language never persisted.

**How to verify fast (curl, authoritative):**
- Sign in: `curl -sS -c /tmp/h.txt -X POST localhost:3000/api/auth/sign-in/email -H 'Content-Type: application/json' -d '{"email":"habits-e2e@example.com","password":"HabitsTest123!"}'`
- Hit the mutation directly to see the throw: `curl -sS -b /tmp/h.txt -X POST "localhost:3000/api/trpc/user.setPreferences?batch=1" -H 'Content-Type: application/json' -d '{"0":{"json":{"currency":"GBP"}}}'` → returns the Prisma error JSON (HTTP 500). When fixed this should be `{json:null}` HTTP 200 AND flip the DB.
- SSR precedence: `curl -sS -b /tmp/h.txt -b "locale=de" localhost:3000/` → `lang="de"`. With DB `language=de` and NO cookie, `/` SSR currently renders `lang="en"` (default) — proving userPref is NOT applied at SSR (a symptom of the same write-failure history + getSession path). Use `grep -ao 'lang="[a-z][a-z]"'` (the `-a` is required — SSR HTML has NUL bytes, see [[i18n-foundation-verify]]).
- Read/check DB pref with a throwaway tsx script (top-level await needs a FILE, `tsx -e` uses cjs and dies on `await`): `prisma.user.findFirst({where:{email},select:{language,currency}})`. Run via `pnpm exec dotenv -e .env.local -- tsx <file>.ts`, then delete.

**Radix Select quirk:** the language/currency dropdowns close before a separate `screenshot` call can catch them open. Use a single `browser_batch` of `[left_click, screenshot]` to capture the open list, or `left_click` the combobox then click the option by coordinate in the next call. `get_page_text` after selecting reflects the new value reliably.

**What's GOOD (don't re-test exhaustively):** DE comparison string is "Mehr/weniger als letzten Monat" (the old English-leak bug is fixed); streak badge aria "Aktueller Streak: 1 Tag" (singular) / dashboard "0 Tage" (plural); heatmap cell labels German long dates ("Montag, 1. Juni"); thousands sep EN `1,234.56` vs DE `1.234,56`; currency display-only (500,00 € → $500.00/£500.00, same digits, no conversion); German + USD works (currency independent of language); de/en catalogs have 0 empty msgstr (151 msgs). Pre-auth login/signup localize on SSR first paint via cookie AND Accept-Language; cross-links are real `<a>`.

**Axis symbol position — FIXED 2026-05-31:** dashboard compact Y-axis ticks are now locale-aware. DE: symbol AFTER (`1,5k $` / `2,3k $`), matching card amounts (`1.747,55 $`). EN: symbol BEFORE (`$1.5k`), matching `US$1,747.55`. (Note EN full amounts use `US$` prefix while the compact axis uses bare `$` — that's standard Intl per-locale behavior, not a bug.)
