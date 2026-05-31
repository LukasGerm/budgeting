---
name: money-domain
description: Currency is integer cents everywhere; Money value object (src/domain/money.ts) is the only currency type and formats at the UI edge
metadata:
  type: project
---

All money in the app is integer **cents**. The `Money` value object (`src/domain/money.ts`) is the only currency representation in the domain — immutable, arithmetic returns new instances, non-integer/non-finite inputs throw.

**Why:** "The DB, the wire, and the domain all speak cents — only the pixels see euros." Keeps rounding decisions at the boundary.

**How to apply:**
- Chart/series money fields are raw `number` cents (e.g. `PacePoint.actualNet`). UI converts back with `Money.fromCents(v).format()`.
- `format()` uses a `de-DE` EUR `Intl.NumberFormat` (e.g. `€1.234,50`) — German thousands `.` and decimal `,`.
- When reviewing display code, expect full-precision `Money.format()` in tooltips/labels. Compact/abbreviated formatting (e.g. axis ticks `€1,2k`) is a presentation concern and is co-located in the component, NOT added to `Money` (see [[dashboard-charts]]).
- Domain barrel is `#/domain` (src/domain/index.ts) — import `Money`, `PacePoint`, etc. from there.
