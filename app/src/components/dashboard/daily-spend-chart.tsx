/**
 * DailySpendChart — one bar per day of the current cycle, sized to that day's
 * **SPEND-only** total (adjustments excluded). Days whose spend exceeds the
 * daily allowance are coloured with the theme's `--destructive` token; days at
 * or under it use the normal chart colour. Per-bar colouring is done with a
 * Recharts `<Cell>` keyed off each bucket's `over` flag, so it tracks dark mode
 * rather than a hardcoded hex.
 *
 * Reads a `DailyBucket[]` (see `domain/dashboard.ts`) whose `spentCents` is
 * integer **cents** — the tooltip converts each back to a euro string via
 * `Money.fromCents(v).format()`.
 *
 * This is a SPEND chart, while the pace line (PaceLineChart) is NET. The card's
 * description spells that out so a day with an adjustment — where the two won't
 * reconcile — isn't confusing.
 *
 * SSR safety: Recharts' `ResponsiveContainer` measures the DOM and reliably
 * triggers hydration mismatches (React #418) when server-rendered. We follow
 * the codebase's `mounted`-flag idiom (see `pace-line-chart.tsx`): SSR and the
 * first client paint render a fixed-height placeholder, and the chart mounts
 * only after the client effect runs — no layout shift, no hydration error.
 */

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "#/components/ui/chart";
import { type DailyBucket, Money } from "#/domain";

const CHART_HEIGHT = "h-[200px]";

const chartConfig = {
	spentCents: {
		label: "Spent",
		color: "var(--chart-1)",
	},
	// Drives the over-allowance bar colour (theme-aware red).
	over: {
		label: "Over allowance",
		color: "var(--destructive)",
	},
} satisfies ChartConfig;

interface DailySpendChartProps {
	buckets: DailyBucket[];
}

export function DailySpendChart({ buckets }: DailySpendChartProps) {
	// Client-only mount gate — see the SSR note above (matches pace-line-chart.tsx).
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	const hasData = buckets.length > 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Daily spend</CardTitle>
				<CardDescription>
					Spends only — adjustments aren't shown here, so this won't match the
					net pace line on adjustment days. Bars over the daily allowance are
					highlighted.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!hasData ? (
					// No days to draw — show a thin affordance instead of an empty chart.
					<div
						className={`${CHART_HEIGHT} flex w-full items-center justify-center text-center text-muted-foreground text-sm`}
					>
						No spending yet this cycle.
					</div>
				) : !mounted ? (
					// SSR / pre-mount placeholder: same height, no chart, no flash.
					<div
						className={`${CHART_HEIGHT} w-full animate-pulse rounded-md bg-muted/30`}
						aria-hidden="true"
					/>
				) : (
					<ChartContainer
						config={chartConfig}
						className={`${CHART_HEIGHT} w-full`}
					>
						<BarChart data={buckets} margin={{ left: 4, right: 8, top: 8 }}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis
								dataKey="day"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tickFormatter={(v) => `Day ${v}`}
								minTickGap={24}
							/>
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(label) => `Day ${label}`}
										formatter={(value) => (
											<div className="flex w-full items-center justify-between gap-3">
												<span className="text-muted-foreground">Spent</span>
												<span className="font-medium font-mono tabular-nums">
													{Money.fromCents(Number(value)).format()}
												</span>
											</div>
										)}
									/>
								}
							/>
							<Bar
								dataKey="spentCents"
								radius={[2, 2, 0, 0]}
								isAnimationActive={false}
							>
								{buckets.map((bucket) => (
									<Cell
										key={bucket.day}
										fill={
											bucket.over
												? "var(--color-over)"
												: "var(--color-spentCents)"
										}
									/>
								))}
							</Bar>
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
