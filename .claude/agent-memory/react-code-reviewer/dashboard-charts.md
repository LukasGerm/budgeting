---
name: dashboard-charts
description: Recharts dashboard charts conventions — SSR mount-gate idiom, per-chart YAxis handling, co-located presentation formatters
metadata:
  type: project
---

Dashboard charts live in `src/components/dashboard/*.tsx`, built on **Recharts** + shadcn's `ChartContainer`/`ChartTooltip` (`#/components/ui/chart`). Each has a co-located `*.test.tsx` (jsdom).

**SSR mount-gate idiom:** Recharts `ResponsiveContainer` measures the DOM and causes hydration mismatch (React #418) on SSR. The convention (cited as originating in `streak-badge.tsx`) is a `mounted` flag: `useState(false)` + `useEffect(() => setMounted(true), [])`, rendering a fixed-height `animate-pulse` placeholder until mounted. This is an ACCEPTED `useEffect` (genuine external-system/DOM sync with no cleanup needed) — do NOT flag it despite the project's avoid-useEffect rule.

**YAxis conventions differ per chart — there is no shared axis formatter:**
- `daily-spend-chart.tsx` — no `<YAxis>` at all.
- `monthly-trend-chart.tsx` — `<YAxis hide>` (value shown via in-bar label).
- `pace-line-chart.tsx` — the ONLY chart with a visible numeric Y-axis. Uses a co-located exported pure helper `formatAxisCents(cents)` producing compact `€1,2k`-style ticks; tooltip keeps full `Money.format()`.

**Co-located presentation formatters:** compact/abbreviated number formatting for a single chart's axis lives in that component (exported for unit testing), not in the `Money` domain object — `Money` stays thin and the format is presentation-specific. See [[money-domain]].
