# Browser Change Verifier — Memory Index

- [Test accounts & data seeding](verify-accounts-and-seeding.md) — working dev creds + exact UI flow to seed budget/spends/adjustments
- [Dashboard SSR behavior](dashboard-route-ssr.md) — /dashboard is SSR-data-loaded; what a regression looks like; spend-only headline rule
- [Chrome MCP verification quirks](chrome-mcp-quirks.md) — tab/browser selection, controlled-input typing, SSR-HTML check trick
- [Authed chrome: nav + gear](authed-chrome-nav-gear.md) — 4-tab bottom nav (no Settings), Settings-as-gear top app-bar, /habits empty state; verified-good shape
- [i18n foundation verify](i18n-foundation-verify.md) — how to control locale via cookie + verify SSR html-lang/nav/money without a switcher; grep -a NUL-byte gotcha
- [i18n switcher persistence](i18n-switcher-persistence.md) — instant switch + DB persistence + cross-device SSR + axis-symbol all PASS (re-verified 2026-05-31); curl/DB verify recipe; Radix Select quirk
