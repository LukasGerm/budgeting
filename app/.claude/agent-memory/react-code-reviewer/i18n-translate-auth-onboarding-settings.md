---
name: i18n-translate-auth-onboarding-settings
description: Issue 05 i18n review — auth/onboarding/settings translated; currency-name Select labels left half-raw (English words won't flip); cross-link Trans single-wrap pattern; locale-aware separator in validation example
metadata:
  type: project
---

Issue 05 translated the four pre-auth/settings surfaces: login.tsx, signup.tsx, _authed/onboarding.tsx, _authed/settings.tsx. Catalog at 142 msgids, EN/DE parity, 0 empty DE msgstrs, "du" register throughout. Blocked on Issue 06 for server error codes (the dynamic `result.error.message ?? t\`Could not sign in.\`` passthrough is intentional here).

**Why:** part of the i18n epic (see [[i18n-foundation]], [[i18n-preferences-switcher]], [[i18n-formatting-seam]], [[i18n-translate-core-app]]). PRD: informal "du", source=EN, resolution userPref>cookie>Accept-Language>en.

**How to apply (recurring review checks for this stack):**
- **Cross-link sentences** must be ONE `<Trans>` wrapping the inline `<Link>`, compiling to a `<0>…</0>` placeholder. Verify the `{" "}` survives and German word order keeps the link placed right ("Noch kein Konto? <0>Registrieren</0>", "Du hast schon ein Konto? <0>Anmelden</0>"). Confirmed correct in this issue.
- **Locale-aware validation examples**: the "Enter a valid amount (e.g. 300 or 1234.50)" msgid uses a dot in EN; DE msgstr correctly uses comma `1234,50` to match `parseAmount`'s locale separator. When reviewing any numeric-example copy, check the separator matches each locale's parser.
- **`t` must be component-scope** from `useLingui()` (`@lingui/react/macro`) for setError/toast/placeholder — never module-scope `t` from `@lingui/core`. `<Trans>` for static JSX. All four files comply.
- **Settings BudgetForm** keyed on `${cents}-${anchor}-${locale}` — locale in the key remounts on language switch so the locale-aware `centsToInputString` separator re-seeds (avoids spurious validation error). Good no-`useEffect` pattern.

**Known gap flagged (non-blocking):** currency `SelectItem` labels in settings.tsx PreferencesSwitcher are half-raw — `EUR — Euro`, `USD — US Dollar`, `GBP — British Pound`, `CHF — Swiss Franc`. The descriptor words ("US Dollar", "British Pound", "Swiss Franc") are English and won't flip to German ("US-Dollar", "Britisches Pfund", "Schweizer Franken"). Language endonyms (English/Deutsch) and the ISO codes themselves are defensibly raw; the trailing currency *names* are the half-translation. Watch for this pattern: a raw-by-design list that smuggled in translatable descriptor words.
