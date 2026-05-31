# Issue 07 — End-to-end i18n verification

**Type:** AFK

## Parent

`plans/i18n/prd.md`

## What to build

A full real-browser smoke test of the complete feature, run end-to-end by
`browser-change-verifier` — the gate before the feature is "done".

- Exercise the whole flow in Chrome: switch German ↔ English, switch currency across
  EUR/USD/GBP/CHF, on each core surface (home, dashboard, history, habits, settings) and
  the pre-auth pages.
- Verify **SSR-correct first paint**, instant switch with **no flash**, **no hydration
  mismatch / console errors**, persistence across reload, and cross-device sync via the
  account preference (fresh session restores the choice).
- Spot-check that no surface shows missing/untranslated message keys in either language.

## Acceptance criteria

- [ ] DE↔EN switch verified on every core surface and the login/signup pages; all copy, formatting, and pluralization correct.
- [ ] Currency switch verified across EUR/USD/GBP/CHF; amounts reformatted, never converted.
- [ ] Server-rendered first paint matches the persisted/detected locale + currency (verified via view-source / network), with **no hydration warnings** and a clean console.
- [ ] Preference persists across reload and is account-bound (new login on a fresh session restores it).
- [ ] No surface shows missing/untranslated message keys in either language.
- [ ] `browser-change-verifier` reports **PASS**.

## Blocked by

- Issues 02, 03, 04, 05, 06.
