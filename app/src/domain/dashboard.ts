/**
 * Dashboard — derived, presentation-oriented figures for the /dashboard tab.
 *
 * These are *spend-labelled* summaries: where Home's available-today / monthly
 * math sums the **net** ledger (spends + signed adjustments), the Dashboard's
 * headline "spent" figures use **SPEND-only** sums. This is the hybrid
 * net-vs-SPEND rule (see PRODUCT.md / the dashboard plan): budget math stays
 * net, but a figure the user reads as "how much I spent" excludes one-off
 * budget tweaks (top-ups, set-asides) so it reflects real outflow.
 *
 * Everything here is pure: it takes the already-bounded current-cycle entries,
 * the cycle, and the caller's local `now`, and returns domain `Money` /
 * numbers. No React, Prisma, or tRPC.
 */

import type { Cycle } from "./cycle";
import { elapsedDaysInCycle, getCurrentCycle, totalDaysInCycle } from "./cycle";
import { sumNet, sumSpends } from "./entry";
import { Money } from "./money";
import type { Budget, Expense } from "./types";

export interface CycleSpendSummary {
	/** SPEND-only total this cycle (adjustments excluded). */
	readonly totalSpent: Money;
	/** `totalSpent` divided by elapsed days (elapsed is ≥1), truncated. */
	readonly avgPerDay: Money;
	/** Whole days remaining in the cycle, clamped to ≥0. */
	readonly daysLeft: number;
}

/**
 * Headline figures for the current cycle.
 *
 * - `totalSpent` is the SPEND-only sum (`sumSpends`) — adjustments are excluded.
 * - `avgPerDay` is `totalSpent / elapsedDaysInCycle(cycle, now)`. Elapsed days
 *   is always ≥1 (the anchor day itself is day 1), so this never divides by
 *   zero; truncation matches the conservative rounding `Money.divideIntFloor`
 *   uses elsewhere.
 * - `daysLeft` is `totalDaysInCycle − elapsedDaysInCycle`, clamped to ≥0 so the
 *   last day of a cycle reads "0 days left" rather than a negative number.
 */
export function cycleSpendSummary(
	cycle: Cycle,
	expenses: Expense[],
	now: Date,
): CycleSpendSummary {
	const totalSpent = sumSpends(expenses);
	const elapsed = elapsedDaysInCycle(cycle, now);
	const avgPerDay = totalSpent.divideIntFloor(elapsed);
	const daysLeft = Math.max(0, totalDaysInCycle(cycle) - elapsed);

	return { totalSpent, avgPerDay, daysLeft };
}

/**
 * One point on the cumulative pace series — `day` is the 1-based day of the
 * cycle (anchor day = 1). Both money figures are **integer cents** (the chart's
 * numeric unit), so the UI converts back with `Money.fromCents(v).format()`.
 */
export interface PacePoint {
	/** 1-based day of the cycle (anchor day is day 1). */
	readonly day: number;
	/** Running **net** total (spends + signed adjustments) through end of `day`, in cents. */
	readonly actualNet: number;
	/** Straight-line ideal consumption through `day` (`monthly × day / totalDays`), in cents. */
	readonly idealNet: number;
}

/**
 * Cumulative pace series for the current cycle: how the running **net** ledger
 * (`sumNet` — the same hybrid math Home's available/monthly figures use, so the
 * two reconcile) tracks against a straight-line ideal, day by day, up to `now`.
 *
 * - One point per elapsed day, `day` running `1..elapsed` where
 *   `elapsed = elapsedDaysInCycle(cycle, now)` (always ≥1, anchor day = day 1).
 *   **No future days are emitted** — the series stops at `now`.
 * - `actualNet` is the running net total of every entry whose `createdAt` falls
 *   on or before the end of that day. Entries are binned into local-midnight
 *   days relative to the cycle's `start`: an entry on day *d* contributes to the
 *   cumulative total of day *d* and every day after. A top-up (stored negative)
 *   lowers the running net; a set-aside (stored positive) raises it.
 *   Out-of-cycle entries (before the anchor, or after `now`) are ignored —
 *   in practice the caller passes already-bounded current-cycle expenses.
 * - `idealNet` is the straight-line consumption to that day:
 *   `monthlyAmount × day / totalDaysInCycle(cycle)`, computed in cents and
 *   **floored** (truncated toward zero, matching `Money.divideIntFloor`), so it
 *   agrees with the conservative rounding used elsewhere.
 *
 * Empty cycle / empty expenses: every `actualNet` is 0 while `idealNet` rises
 * linearly, so the chart shows the ideal line with a flat actual line at zero.
 */
export function cumulativePaceSeries(
	cycle: Cycle,
	expenses: Expense[],
	monthlyAmount: Money,
	now: Date,
): PacePoint[] {
	const elapsed = elapsedDaysInCycle(cycle, now);
	const totalDays = totalDaysInCycle(cycle);
	const monthlyCents = monthlyAmount.toCents();

	// Bin each entry's net cents into its 1-based cycle day. `dayOfCycle` mirrors
	// `elapsedDaysInCycle`: the cycle start is day 1, so an entry's day is the
	// whole-day offset from `cycle.start` plus 1.
	const netByDay = new Map<number, number>();
	for (const e of expenses) {
		const day = dayOfCycle(cycle, e.createdAt);
		if (day < 1 || day > elapsed) continue; // outside [start, now]
		const cents = sumNet([e]).toCents();
		netByDay.set(day, (netByDay.get(day) ?? 0) + cents);
	}

	const series: PacePoint[] = [];
	let runningNet = 0;
	for (let day = 1; day <= elapsed; day++) {
		runningNet += netByDay.get(day) ?? 0;
		// monthly × day / totalDays, floored toward zero (totalDays ≥ 1 always).
		const idealNet = Math.trunc((monthlyCents * day) / totalDays);
		series.push({ day, actualNet: runningNet, idealNet });
	}
	return series;
}

/**
 * One bar of the daily-spend chart — `day` is the 1-based day of the cycle
 * (anchor day = 1). `spentCents` is **integer cents** (the chart's numeric
 * unit), so the UI converts back with `Money.fromCents(v).format()`.
 */
export interface DailyBucket {
	/** 1-based day of the cycle (anchor day is day 1). */
	readonly day: number;
	/** SPEND-only total for that day, in cents (adjustments excluded). */
	readonly spentCents: number;
	/** Whether that day's spend exceeds the daily allowance. */
	readonly over: boolean;
}

/** Result of {@link dailySpendBuckets}: the per-day bars plus the over/under threshold. */
export interface DailySpendBuckets {
	/** One bucket per day of the full cycle (1..`totalDaysInCycle`). */
	readonly buckets: DailyBucket[];
	/** Daily-allowance threshold used for the over/under colouring, in cents. */
	readonly dailyAllowanceCents: number;
}

/**
 * Per-day SPEND-only outflow for the current cycle, with the daily-allowance
 * threshold that drives the over/under colouring.
 *
 * - **Day range: the FULL cycle** (`day` runs `1..totalDaysInCycle(cycle)`),
 *   not just elapsed days. The issue asks for "one bar per day of the current
 *   cycle"; emitting every day (with 0 for days that have no spend) shows the
 *   cycle's overall shape rather than truncating at "today". Days with no spend
 *   read as 0.
 * - **SPEND-only**: only `kind === "spend"` entries contribute (their `amount`
 *   summed in cents). Adjustments — top-ups and set-asides — are deliberately
 *   excluded: a chart the user reads as "what I spent" must honestly show real
 *   outflow, not one-off budget tweaks. (Contrast `cumulativePaceSeries`, which
 *   is NET — so a day with an adjustment will not reconcile between the two.)
 * - **Binning** is by local-midnight day-of-cycle via the same `dayOfCycle`
 *   helper the pace series uses (DST-robust UTC-triple math). Multiple spends on
 *   the same day sum into that day's bucket; out-of-cycle entries are ignored
 *   (in practice the caller passes already-bounded current-cycle expenses).
 * - **`dailyAllowanceCents`** is the monthly budget spread evenly across the
 *   cycle: `monthlyAmount.cents / totalDaysInCycle(cycle)` (kept fractional so
 *   the threshold is exact for the strict `>` comparison). A day is `over` when
 *   its `spentCents` is strictly greater than this threshold.
 *
 * Empty cycle / empty expenses: every bucket is `{ spentCents: 0, over: false }`.
 */
export function dailySpendBuckets(
	cycle: Cycle,
	expenses: Expense[],
	monthlyAmount: Money,
): DailySpendBuckets {
	const totalDays = totalDaysInCycle(cycle);
	const dailyAllowanceCents = monthlyAmount.toCents() / totalDays;

	// Bin SPEND-only outflow into its 1-based cycle day.
	const spentByDay = new Map<number, number>();
	for (const e of expenses) {
		if (e.kind !== "spend") continue; // adjustments excluded
		const day = dayOfCycle(cycle, e.createdAt);
		if (day < 1 || day > totalDays) continue; // outside the cycle
		spentByDay.set(day, (spentByDay.get(day) ?? 0) + e.amount.toCents());
	}

	const buckets: DailyBucket[] = [];
	for (let day = 1; day <= totalDays; day++) {
		const spentCents = spentByDay.get(day) ?? 0;
		buckets.push({
			day,
			spentCents,
			over: spentCents > dailyAllowanceCents,
		});
	}
	return { buckets, dailyAllowanceCents };
}

/** Day-1 boundary below which the projection is suppressed (see {@link projectEndOfCycle}). */
const PROJECTION_MIN_ELAPSED_DAYS = 2;

/**
 * Projected end-of-cycle outcome — the discriminated result of
 * {@link projectEndOfCycle}.
 *
 * `suppressed` is the early-cycle signal: too few days have elapsed for a
 * meaningful extrapolation, so the UI renders nothing. Otherwise the projection
 * carries the extrapolated full-cycle net, the over/under-budget direction, and
 * the (always non-negative) gap to the budget for display.
 */
export type EndOfCycleProjection =
	| { readonly suppressed: true }
	| {
			readonly suppressed: false;
			/** Linear extrapolation of **net** spend to the full cycle. */
			readonly projectedNet: Money;
			/** Whether `projectedNet` lands over or under the monthly budget. */
			readonly overUnder: "under" | "over";
			/** Absolute gap between `projectedNet` and the budget (≥0; direction is in `overUnder`). */
			readonly difference: Money;
	  };

/**
 * Project where the current cycle is on pace to finish, by extrapolating the
 * net burn rate so far across the whole cycle.
 *
 * - Computes the cycle internally via `getCurrentCycle(now, budget.anchorDay)`.
 * - `projectedNet = netSoFar × totalDays / elapsedDays`, where `netSoFar` is the
 *   **net** ledger (`sumNet` — spends + signed adjustments, the same hybrid
 *   basis as the pace line and Home, so the figures reconcile). The math is done
 *   in cents via `Money` ops (`scaleInt` then `divideIntFloor`), truncated toward
 *   zero like the rest of the dashboard's conservative rounding. A top-up (stored
 *   negative) lowers `netSoFar` and thus the projection; a set-aside (stored
 *   positive) raises it — so the projection is a NET figure, not spend-only.
 * - `overUnder` is `"over"` when `projectedNet > budget.monthlyAmount`, else
 *   `"under"` (exactly on budget reads as `"under"` — i.e. not over).
 * - `difference` is the absolute gap `|projectedNet − monthlyAmount|`, always a
 *   non-negative `Money` for display; the sign/direction is carried by
 *   `overUnder`.
 *
 * Suppression: when fewer than {@link PROJECTION_MIN_ELAPSED_DAYS} (2) days have
 * elapsed — i.e. `elapsedDaysInCycle(cycle, now) < 2` — the extrapolation factor
 * is too volatile to be useful, so this returns `{ suppressed: true }` and the
 * UI shows nothing. Concretely: suppressed on **day 1** (the anchor day) only;
 * the caption first appears on **day 2**.
 */
export function projectEndOfCycle(
	budget: Budget,
	expenses: Expense[],
	now: Date,
): EndOfCycleProjection {
	const cycle = getCurrentCycle(now, budget.anchorDay);
	const elapsed = elapsedDaysInCycle(cycle, now);
	if (elapsed < PROJECTION_MIN_ELAPSED_DAYS) {
		return { suppressed: true };
	}

	const totalDays = totalDaysInCycle(cycle);
	const netSoFar = sumNet(expenses);
	// netSoFar × totalDays / elapsed, in cents, truncated toward zero.
	const projectedNet = netSoFar.scaleInt(totalDays).divideIntFloor(elapsed);

	const overUnder =
		projectedNet.toCents() > budget.monthlyAmount.toCents() ? "over" : "under";
	const difference = Money.fromCents(
		Math.abs(projectedNet.toCents() - budget.monthlyAmount.toCents()),
	);

	return { suppressed: false, projectedNet, overUnder, difference };
}

/**
 * One cycle's net total, for the cross-cycle monthly trend. `netCents` is
 * **integer cents** (the chart's numeric unit), so the UI converts back with
 * `Money.fromCents(v).format()`. `cycle` is carried through so the chart can
 * derive an axis label (e.g. the cycle's month from `cycle.start`).
 */
export interface CycleTotal {
	/** The cycle this total covers. */
	readonly cycle: Cycle;
	/** **Net** total (spends + signed adjustments) for the cycle, in cents. */
	readonly netCents: number;
	/** How many entries fell inside this cycle (drives the "has data" rule). */
	readonly entryCount: number;
}

/**
 * Per-cycle **net** total for the monthly trend, one entry per input cycle, in
 * the same order as `cycles` (the caller passes them newest → oldest, so the
 * result is too).
 *
 * - **Net basis** (`sumNet`): each cycle's figure is the running ledger total —
 *   spends plus signed adjustments — matching the hybrid rule used by the pace
 *   line, the projection, and Home (a top-up lowers the cycle's net, a set-aside
 *   raises it). This is the figure compared against the monthly budget on the
 *   trend chart, so the budget math stays net.
 * - **Binning**: an expense lands in exactly the cycle whose half-open interval
 *   `[start, end)` contains its `createdAt` — `start <= createdAt < end`. Cycles
 *   tile without gaps or overlaps, so each in-range expense is counted once.
 *   Expenses outside *every* cycle (older than the oldest `start`, or at/after
 *   the newest `end`) are ignored.
 * - `entryCount` records how many expenses fell in each cycle so a consumer can
 *   tell a genuinely-empty cycle (no entries → 0 net, count 0) from one that
 *   nets to zero by coincidence (e.g. a spend cancelled by a top-up → 0 net,
 *   count 2). The trend's "has data" rule keys off this, not off `netCents`.
 *
 * Empty cycles / empty expenses: every total is `{ netCents: 0, entryCount: 0 }`.
 */
export function cycleTotals(
	cycles: Cycle[],
	expenses: Expense[],
): CycleTotal[] {
	// Accumulate per cycle index. Cycles are non-overlapping, so a simple linear
	// scan assigns each expense to at most one cycle.
	const netByIndex = new Array<number>(cycles.length).fill(0);
	const countByIndex = new Array<number>(cycles.length).fill(0);

	for (const e of expenses) {
		const at = e.createdAt.getTime();
		const idx = cycles.findIndex(
			(c) => at >= c.start.getTime() && at < c.end.getTime(),
		);
		if (idx === -1) continue; // outside every cycle
		netByIndex[idx] += sumNet([e]).toCents();
		countByIndex[idx] += 1;
	}

	return cycles.map((cycle, i) => ({
		cycle,
		netCents: netByIndex[i],
		entryCount: countByIndex[i],
	}));
}

/**
 * vs.-last-cycle comparison — this cycle's **net** spend so far against the same
 * elapsed point in the previous cycle.
 *
 * `currentNet` is the net of the CURRENT cycle through `now`; `lastNetAtSameDay`
 * is the net of the PREVIOUS cycle through the SAME elapsed day (not the previous
 * cycle's full total). `direction` says which way the change runs and `pct` is the
 * absolute rounded percentage change (or `null` when the baseline is zero — see
 * {@link compareToLastCycle}).
 */
export interface CycleComparison {
	/** **Net** of the current cycle (`cycles[0]`) from its start through `now`. */
	readonly currentNet: Money;
	/**
	 * **Net** of the previous cycle (`cycles[1]`) from its start through the same
	 * elapsed day as the current cycle (`elapsedDaysInCycle(cycles[0], now)`,
	 * clamped to the previous cycle's length).
	 */
	readonly lastNetAtSameDay: Money;
	/**
	 * Absolute rounded percentage change of `currentNet` vs `lastNetAtSameDay`
	 * (`round(|cur − last| / last × 100)`). `null` when `lastNetAtSameDay` is 0
	 * (no meaningful baseline to divide by); the sign/direction lives in
	 * `direction`.
	 */
	readonly pct: number | null;
	/** Which way the change runs: current `< / > / =` last-at-same-day. */
	readonly direction: "less" | "more" | "same";
}

/**
 * Compare the current cycle's **net** spend "so far" to the same elapsed point
 * in the previous cycle.
 *
 * `cycles` is the newest → oldest array `getRecentCycles` yields (same input as
 * {@link cycleTotals}): `cycles[0]` is the current cycle, `cycles[1]` the one
 * before it. `expenses` spans those cycles (multi-cycle list).
 *
 * - **No previous cycle → `null`.** When `cycles.length < 2` there is nothing to
 *   compare against, so this returns `null` and the UI renders nothing.
 * - **Net basis** (`sumNet`): both figures sum spends + signed adjustments — a
 *   top-up (stored negative) lowers a cycle's net, a set-aside (stored positive)
 *   raises it — matching the hybrid rule used by the pace line, the projection,
 *   and Home.
 * - **`currentNet`**: net of every current-cycle (`cycles[0]`) entry whose
 *   day-of-cycle index is ≤ `elapsed = elapsedDaysInCycle(cycles[0], now)` — i.e.
 *   from the cycle start through `now`.
 * - **`lastNetAtSameDay`** — the same-elapsed-day cutoff, NOT the previous cycle's
 *   full total: net of every previous-cycle (`cycles[1]`) entry whose
 *   day-of-cycle index is ≤ `cutoffDay`, where `cutoffDay = min(elapsed,
 *   totalDaysInCycle(cycles[1]))`. The clamp matters because the previous cycle
 *   may be shorter than the current one (28-day Feb vs 31-day Mar); without it the
 *   cutoff could exceed the previous cycle's length, but since entries can only
 *   exist on real days the clamp is just defensive — no out-of-range day is
 *   counted either way. Binning reuses the `dayOfCycle` helper.
 * - **`pct`**: `round(|currentNet − lastNetAtSameDay| / lastNetAtSameDay × 100)`,
 *   an absolute integer percentage; the sign is carried by `direction`.
 * - **`direction`**: `"less"` when `currentNet < lastNetAtSameDay`, `"more"` when
 *   greater, `"same"` when equal (compared in cents).
 * - **Zero baseline**: when `lastNetAtSameDay` is 0 we cannot divide, so `pct` is
 *   `null`. If `currentNet` is also 0 the cycles match → `direction: "same"`;
 *   otherwise `currentNet` is non-zero against a zero baseline → `direction:
 *   "more"` (more was spent than the nothing spent last time). This never yields
 *   NaN/Infinity.
 */
export function compareToLastCycle(
	cycles: Cycle[],
	expenses: Expense[],
	now: Date,
): CycleComparison | null {
	// No previous cycle to compare against.
	if (cycles.length < 2) return null;

	const current = cycles[0];
	const previous = cycles[1];
	const elapsed = elapsedDaysInCycle(current, now);
	// Same elapsed day in the previous cycle, clamped to its length (it may be
	// shorter — e.g. 28-day Feb vs 31-day Mar).
	const cutoffDay = Math.min(elapsed, totalDaysInCycle(previous));

	// Net of current-cycle entries from start through `now` (day ≤ elapsed).
	let currentCents = 0;
	for (const e of expenses) {
		const day = dayOfCycle(current, e.createdAt);
		if (day < 1 || day > elapsed) continue;
		currentCents += sumNet([e]).toCents();
	}

	// Net of previous-cycle entries from start through the same elapsed day.
	let lastCents = 0;
	for (const e of expenses) {
		const day = dayOfCycle(previous, e.createdAt);
		if (day < 1 || day > cutoffDay) continue;
		lastCents += sumNet([e]).toCents();
	}

	const direction =
		currentCents === lastCents
			? "same"
			: currentCents < lastCents
				? "less"
				: "more";

	// Zero baseline: nothing to divide by — leave pct null (direction carries it).
	const pct =
		lastCents === 0
			? null
			: Math.round((Math.abs(currentCents - lastCents) / lastCents) * 100);

	return {
		currentNet: Money.fromCents(currentCents),
		lastNetAtSameDay: Money.fromCents(lastCents),
		pct,
		direction,
	};
}

/**
 * The largest **SPEND** entries this cycle, biggest first.
 *
 * - **SPEND-only**: only `kind === "spend"` entries are eligible — top-ups and
 *   set-asides are excluded entirely, even when an adjustment's magnitude is
 *   larger than every spend. This list answers "what did I actually spend the
 *   most on", so one-off budget tweaks must never appear in it.
 * - **Sort: amount descending** by `.toCents()`. Ties (equal amounts) break by
 *   **newer `createdAt` first**, then by **`id` ascending** as a final stable
 *   tiebreak — so the result is fully deterministic regardless of input order.
 * - Returns at most `n`. Empty input, no spends, or `n <= 0` ⇒ `[]`.
 * - **Does not mutate** the input: it filters into a fresh array before sorting.
 */
export function biggestSpends(expenses: Expense[], n: number): Expense[] {
	if (n <= 0) return [];

	// Copy (filter yields a new array) so the caller's array is never reordered.
	const spends = expenses.filter((e) => e.kind === "spend");

	spends.sort((a, b) => {
		// Amount descending.
		const byAmount = b.amount.toCents() - a.amount.toCents();
		if (byAmount !== 0) return byAmount;
		// Tie: newer first.
		const byDate = b.createdAt.getTime() - a.createdAt.getTime();
		if (byDate !== 0) return byDate;
		// Final stable tiebreak: id ascending.
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});

	return spends.slice(0, n);
}

/**
 * 1-based day of the cycle for a given instant: the whole-day offset of the
 * entry's local calendar day from the cycle's start, plus 1 (so an entry on the
 * anchor day is day 1). Uses UTC arithmetic on the (y, m, d) triples to stay
 * DST-robust, matching `cycle.ts`'s `daysBetween`.
 */
function dayOfCycle(cycle: Cycle, at: Date): number {
	const startUtc = Date.UTC(
		cycle.start.getFullYear(),
		cycle.start.getMonth(),
		cycle.start.getDate(),
	);
	const atUtc = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());
	const days = Math.round((atUtc - startUtc) / (24 * 60 * 60 * 1000));
	return days + 1;
}
