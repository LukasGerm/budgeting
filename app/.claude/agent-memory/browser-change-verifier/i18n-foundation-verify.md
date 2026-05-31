---
name: i18n-foundation-verify
description: How to verify the Lingui i18n locale plumbing (cookie/Accept-Language → server locale, html lang, money format) without a UI switcher
metadata:
  type: project
---

Issue-01 i18n foundation (Lingui v6) verified PASS 2026-05-31. Locale resolves SERVER-SIDE: userPref → `locale` cookie (`en`/`de`) → `Accept-Language` (de/en) → default `en`. `<html lang>` is bound to it. There is NO locale switcher in this slice — control locale via the `locale` cookie directly.

**Authoritative SSR check without a switcher (use this for any i18n verification):**
- `<html lang>` + Accept-Language precedence is testable on the PUBLIC `/login` route with plain curl + `-H "Accept-Language: …"` / `-H "Cookie: locale=…"`. Cookie wins over Accept-Language; garbage cookie → default `en`.
- For the AUTHED localized surfaces (bottom-nav labels + Home money), get a session cookie via the better-auth API, then curl `/` with `-b cookies.txt -b "locale=de"`:
  `curl -sS -c /tmp/c.txt -X POST localhost:3000/api/auth/sign-in/email -H 'Content-Type: application/json' -d '{"email":"habits-e2e@example.com","password":"HabitsTest123!"}'`
  then `curl -sS -b /tmp/c.txt -b "locale=de" localhost:3000/` → true SSR first-paint HTML carrying both cookies.

**GOTCHA — grep the SSR HTML with `grep -a`.** The streamed SSR HTML contains NUL bytes, so plain grep treats it as binary and silently matches NOTHING (returns 0 with no error). Always `grep -a`/`grep -ao`. Cost me several wasted calls.

**Expected good output (account budget 500 €):**
- Nav (en SSR): `>Home< >Dashboard< >History< >Habits<`; (de SSR): `>Start< >Dashboard< >Verlauf< >Gewohnheiten<`. aria-label stays the English SOURCE string in both locales (`<Trans>` only swaps visible text).
- Money (en): `€500.00` (symbol before, dot decimal). Money (de): `500,00 €` (symbol AFTER, comma decimal). Currency hardcoded EUR this slice — only number format flips. Values <1000 don't exercise the thousands separator (de `1.234,56` dot-thousands) — seed a ≥1000 amount if you must prove that.
- Macro-working signature: NO `data-lingui` / `<Trans` / `{0}` / msgid leakage in the HTML (`grep -ac` = 0). Raw IDs or empty nav = macro transform broken (the `@rolldown/plugin-babel`/babel-macro wiring is the fragile part).
- Live hydration: hard reload (cmd+shift+r) of `/`, then `read_console_messages` — only `[vite] connecting/connected` DEBUG lines; ZERO #418/#423/hydration-mismatch/Warning. Console tracking RESETS on hard reload, so read it AFTER the reload+wait.

**Catalogs/scripts (acceptance, non-browser):** `src/locales/{en,de}/messages.po` + compiled `.ts`, `lingui.config.ts`, and `extract`/`compile` pnpm scripts all exist.

**DevTools dead-end:** chrome-MCP can't drive the DevTools panel (cmd+alt+j screenshots still show the page, not the console), and there's no JS-eval tool. Don't try to set `document.cookie` from the page — use the curl-with-cookie route above instead.
