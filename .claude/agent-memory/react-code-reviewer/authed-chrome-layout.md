---
name: authed-chrome-layout
description: _authed layout chrome — sticky top app-bar (Settings gear) + fixed BottomNav; page bodies own their own header in a shared container; onboarding is chrome-free
metadata:
  type: project
---

The `_authed` layout (`src/routes/_authed.tsx`) renders the persistent app chrome around `<Outlet />`:

- **Top app-bar**: `<header className="sticky top-0 z-30 ...backdrop-blur...">` containing a ghost icon `Button asChild` wrapping `<Link to="/settings" aria-label="Settings">` with a `<Settings>` icon (`aria-hidden`). Inner content constrained to `mx-auto max-w-md px-8 py-2` so the gear aligns with page bodies, not the viewport edge.
- **Bottom nav**: `BottomNav` (`src/components/bottom-nav.tsx`) is `fixed bottom-0 z-30`. `TABS` = Home (`exact: true`) · Dashboard · History · Habits (all `exact: false`). Settings is NOT a tab — it lives only in the top gear. Active state via `Link` render-prop `isActive` / `data-[status=active]`.
- Both bars gated on `showNav = pathname !== "/onboarding"`. Onboarding is the one authed screen rendered chrome-free (guided flow, no budget yet).

**Layout math to check on any chrome/layout change:**
- Outer wrapper: `flex min-h-svh flex-col pt-[env(safe-area-inset-top)]`, plus `pb-[calc(4rem + env(safe-area-inset-bottom))]` (only when `showNav`) for bottom-nav clearance.
- Top bar is `sticky` (in flow), NOT `fixed`, so pages need no extra top padding — the bar pushes content down naturally and page `<header>`s render cleanly below it. This is deliberate: Home's StreakChip lives inside the page container, so it can't collide with the gear.

**Page-body container idiom** (match verbatim for new authed pages): `mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8` (Home uses `gap-12`). Each page owns its own `<header>` with `<h1 className="font-medium text-lg">` + a muted `text-sm` subtitle. Dashboard, Settings, Habits all follow this.

**Why:** server-first PWA with iOS safe-area insets; chrome is declared once in the layout, never per-route.
**How to apply:** when reviewing a new authed route, confirm it uses the shared container, owns a matching header, and does NOT re-declare nav/gear. When reviewing chrome changes, re-check the `min-h-svh` flex math and the safe-area inset interaction (sticky `top-0` under the status-bar `pt` inset is an explicit "confirm visually" item — recommend a browser check).
