/**
 * HeadlineStats — the Dashboard's headline card: three at-a-glance figures for
 * the current cycle (total spent, average per day, days left).
 *
 * Pure presentational: it takes a `CycleSpendSummary` and renders it, so it's
 * component-testable in isolation (props in, JSX out — no hooks, no data
 * fetching). Money renders via `Money.format()` (de-DE / EUR); days left is a
 * plain integer with a unit label.
 */

import { Card, CardContent } from "#/components/ui/card";
import type { CycleSpendSummary } from "#/domain";

interface HeadlineStatsProps {
	summary: CycleSpendSummary;
}

interface StatProps {
	label: string;
	value: string;
}

function Stat({ label, value }: StatProps) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</dt>
			<dd className="font-semibold text-2xl tabular-nums tracking-tight">
				{value}
			</dd>
		</div>
	);
}

export function HeadlineStats({ summary }: HeadlineStatsProps) {
	return (
		<Card>
			<CardContent>
				<dl className="grid grid-cols-2 gap-6">
					<Stat label="Spent this cycle" value={summary.totalSpent.format()} />
					<Stat label="Average / day" value={summary.avgPerDay.format()} />
					<Stat
						label="Days left"
						value={`${summary.daysLeft} ${summary.daysLeft === 1 ? "day" : "days"}`}
					/>
				</dl>
			</CardContent>
		</Card>
	);
}
