/**
 * ProjectionCaption — a one-line, plain-language read-out of where the current
 * cycle is on pace to finish, extrapolating the net burn rate to the full cycle
 * (e.g. "On pace to finish 42,17 € under budget.").
 *
 * Pure presentational: it takes the {@link EndOfCycleProjection} result (the
 * output of `projectEndOfCycle`) and renders it, so it's component-testable in
 * isolation (props in, JSX out — no hooks, no data fetching).
 *
 * Early-cycle suppression: when the projection is `suppressed` (fewer than 2
 * days elapsed — day 1 only), this renders nothing. The over-budget case is set
 * in `text-destructive` to match how Home styles negatives, so an unfavourable
 * projection reads as a warning.
 */

import { Card, CardContent } from "#/components/ui/card";
import type { EndOfCycleProjection } from "#/domain";

interface ProjectionCaptionProps {
	projection: EndOfCycleProjection;
}

export function ProjectionCaption({ projection }: ProjectionCaptionProps) {
	// Early-cycle suppressed state: the extrapolation is too volatile to show.
	if (projection.suppressed) return null;

	const isOver = projection.overUnder === "over";

	return (
		<Card>
			<CardContent>
				<p
					className={`text-sm ${isOver ? "text-destructive" : "text-muted-foreground"}`}
				>
					On pace to finish{" "}
					<span className="font-semibold tabular-nums">
						{projection.difference.format()}
					</span>{" "}
					{isOver ? "over" : "under"} budget.
				</p>
			</CardContent>
		</Card>
	);
}
