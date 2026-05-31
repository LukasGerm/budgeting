---
name: daykey-convention
description: dayKey is non-zero-padded local Y-(0-month)-D; never compare dayKey strings with </> — lexicographic compare is wrong (the 9→10 boundary). Compare Dates/timestamps instead.
metadata:
  type: project
---

`dayKey(d)` (defined identically in `src/domain/streak.ts` and `src/domain/habit.ts`) is
`` `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` `` — **local parts, zero-indexed month, NOT zero-padded**. Examples: `"2025-2-5"` (Mar 5), `"2025-2-10"` (Mar 10).

**Why:** the format is a set-membership key (binning days into a Set/Map), chosen to be DST-safe by using local calendar parts rather than ms arithmetic. It is deliberately NOT a sortable key.

**How to apply (recurring review check):**
- Equality (`===`, `Set.has`, `Map.get`) on dayKey is fine and intended.
- **Ordering/comparison (`<`, `>`, `<=`, `>=`) on dayKey strings is a BUG.** Non-zero-padding breaks lexicographic order at the single→double digit boundary: `"2025-2-10" > "2025-2-9"` is `false`, and month `"2025-10-5"` sorts before `"2025-2-5"`. Flag any `key > todayKey` / `key < ...` style comparison. The correct test for "is this cell in the future" is comparing the `Date`/timestamp (e.g. `cellDate.getTime() > today.getTime()` after normalising both to local midnight, or `dayStartMs` like `streak.ts` does), never the string.
- Found in `buildHeatmap` (habit slice 1): `if (key > todayKey)` mis-tagged genuine future cells as `missed` whenever today's date was a single digit (e.g. Mar 9 → Mar 10–15 wrongly `missed`). The existing unit tests missed it because they only used `today` on the 16th/20th, where the lexicographic compare accidentally agrees.
- **Test-gap heuristic:** heatmap/streak tests must include a `today` straddling the 9→10 day boundary (and ideally a month straddling 9→10), not just dates ≥ 10.

**@db.Date round-trip trap (relevant from slice 3 on):** Prisma returns a `@db.Date` column as a `Date` at UTC midnight. Calling `dayKey()` on it uses *local* parts, so in any timezone west of UTC the day shifts back by one (stored Mar 5 → `dayKey` "Mar 4" in America/Los_Angeles). Do NOT feed raw `@db.Date` Dates through `dayKey`; build the key from the date's UTC parts (or format the day as a string on the wire and skip the Date entirely). The header comment in `habit.ts` currently advises the opposite — treat that comment as wrong.

Related: [[dashboard-charts]] (also client-owns-"today"), and the project rule that the server never computes "today".
