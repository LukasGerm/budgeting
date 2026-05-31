---
name: module-e-pattern
description: Domain copy-builder refactor pattern — functions return discriminated unions, components assemble English prose inline; Issue 04 wraps in <Trans>
metadata:
  type: project
---

Module E refactor (Issue 03) establishes the pattern for domain copy-builders:

- `getMonthlyStatus(remaining, budget, elapsed, total): MonthlyStatus` in `src/domain/monthly-status.ts` — returns `{ kind: "over_budget"; remainingCents }` or `{ kind: "on_track"; remainingCents; budgetCents; elapsedDays; totalDays }`. Old `formatMonthlyStatus` with injected `formatMoney` is gone.
- `getRelativeDate(date, now): RelativeDate` in `src/domain/relative-date.ts` — returns `{ kind: "today" }`, `{ kind: "yesterday" }`, or `{ kind: "days_ago"; days }`. Old `formatRelativeDate` returning a string is gone. `calendarDaysAgo` is now exported (was private).
- Both are exported from `src/domain/index.ts` with their union types.

**Consuming components:** assemble English copy inline from the union (e.g. `rel.kind === "today" ? "today" : ...`). Issue 04 will wrap that inline assembly in `<Trans>`/`plural`.

**Why:** keeps domain logic pure and testable; component renders formatted money/dates via `useFormat()` from the structured data; enables translation in Issue 04 without touching domain layer again.

**How to apply:** any future domain copy-builder should follow this pattern — return structured data, never finished prose, never accept a `formatMoney` injection.
