/**
 * HeadlineStats — the Dashboard's headline card: three at-a-glance figures for
 * the current cycle (total spent, average per day, days left).
 *
 * Pure presentational: it takes a `CycleSpendSummary` and renders it, so it's
 * component-testable in isolation (props in, JSX out — no hooks, no data
 * fetching). Money renders via `useFormat().formatMoney`; days left is a
 * plain integer with a unit label.
 */

import { Plural, Trans } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { Card, CardContent } from "#/components/ui/card";
import type { CycleSpendSummary } from "#/domain";
import { useFormat } from "#/i18n/use-format";

interface HeadlineStatsProps {
	summary: CycleSpendSummary;
}

interface StatProps {
	label: ReactNode;
	value: ReactNode;
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
	const { formatMoney } = useFormat();

	return (
		<Card>
			<CardContent>
				<dl className="grid grid-cols-2 gap-6">
					<Stat
						label={<Trans>Spent this cycle</Trans>}
						value={formatMoney(summary.totalSpent.toCents())}
					/>
					<Stat
						label={<Trans>Average / day</Trans>}
						value={formatMoney(summary.avgPerDay.toCents())}
					/>
					<Stat
						label={<Trans>Days left</Trans>}
						value={
							<Plural value={summary.daysLeft} one="# day" other="# days" />
						}
					/>
				</dl>
			</CardContent>
		</Card>
	);
}
