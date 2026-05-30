/**
 * VsLastDelta — a one-line read-out comparing this cycle's net spend "so far" to
 * the same elapsed point in the previous cycle (e.g. "12% less than last cycle so
 * far").
 *
 * Pure presentational: it takes the {@link CycleComparison} result (the output of
 * `compareToLastCycle`) and renders it, so it's component-testable in isolation
 * (props in, JSX out — no hooks, no data fetching).
 *
 * Renders **nothing** when there is no previous cycle to compare against
 * (`comparison === null`). The "more" case is set in `text-destructive` to match
 * how Home styles negatives, so spending more than last cycle reads as a warning.
 * When `pct` is `null` (a zero baseline — nothing was spent at the same point last
 * cycle) the bare percentage is dropped in favour of a plain "more"/"about the
 * same" phrasing.
 */

import { Card, CardContent } from "#/components/ui/card";
import type { CycleComparison } from "#/domain";

interface VsLastDeltaProps {
	comparison: CycleComparison | null;
}

export function VsLastDelta({ comparison }: VsLastDeltaProps) {
	// No previous cycle → nothing to compare against.
	if (!comparison) return null;

	const isMore = comparison.direction === "more";

	return (
		<Card>
			<CardContent>
				<p
					className={`text-sm ${isMore ? "text-destructive" : "text-muted-foreground"}`}
				>
					{renderBody(comparison)}
				</p>
			</CardContent>
		</Card>
	);
}

/**
 * The comparison sentence. With a percentage: "**12% less** than last cycle so
 * far". On a zero baseline (`pct === null`): "About the same as last cycle so far"
 * (both zero) or "**More** than last cycle so far" (current outspent a zero last
 * cycle). An exactly-equal non-zero comparison reads "About the same…".
 */
function renderBody(comparison: CycleComparison) {
	const { pct, direction } = comparison;

	if (direction === "same") {
		return "About the same as last cycle so far";
	}

	if (pct === null) {
		// Zero baseline with a non-zero current (direction is "more").
		return (
			<>
				<span className="font-semibold">More</span> than last cycle so far
			</>
		);
	}

	return (
		<>
			<span className="font-semibold tabular-nums">{pct}% </span>
			<span className="font-semibold">{direction}</span> than last cycle so far
		</>
	);
}
