# Issue 04 — Translate UI strings: core app (home, shell, dashboard, history, habits)

**Type:** AFK

## Parent

`plans/i18n/prd.md`

## What to build

Make the authed core app fully bilingual. Wrap **every** user-facing string in the
core surfaces with Lingui macros, including text that combines with numbers/dates from
the formatting slice.

- Surfaces: app shell (header, bottom nav), **home** (date label, monthly-status
  sentence, spend sheet, toasts), **dashboard** (card titles/descriptions, chart configs,
  captions, placeholders), **history** (list copy, relative-date sentence), **habits**
  (checklist, badges, dialogs).
- Use `<Trans>` for static copy, `t`/`msg` for imperative strings (toasts, aria-labels),
  and **`plural`** for count-bearing copy (e.g. "N days ago", "day X of Y", item counts).
- Assemble the sentences whose data now comes from Module E (monthly status, relative
  date) in the components via `<Trans>` + `plural`.
- `lingui extract`, fill the **German catalog** in the informal **"du"** register, then
  `lingui compile`.

## Acceptance criteria

- [ ] Every visible string, toast, and aria-label across home, shell, dashboard, history, and habits is wrapped in a Lingui macro (no raw literals remain in these surfaces).
- [ ] Switching language flips all of the above between German and English, including pluralized/count strings, with correct grammar.
- [ ] German copy uses the informal "du" register throughout (verified by the reviewer agent against the catalog).
- [ ] Component tests for these surfaces are wrapped in `I18nProvider` + locale/currency context and assert per-locale output (or locale-agnostic structure where copy is incidental); previously English-string-asserting tests are migrated.
- [ ] No untranslated/missing-message warnings for these surfaces; `pnpm exec tsc --noEmit`, `pnpm check`, `pnpm test` green.

## Blocked by

- Issue 01 (foundation) and Issue 03 (formatting — needed for the text+number sentences).
