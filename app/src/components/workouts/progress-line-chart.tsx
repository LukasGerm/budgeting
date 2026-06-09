/**
 * ProgressLineChart — one kg-over-sessions line chart in a Card, used twice
 * on the exercise progress screen ("Best set weight" and "Session volume").
 *
 * Points carry integer **grams** (the storage convention); the chart plots
 * `grams / 1000` so the Y axis reads in kg, and the tooltip goes back through
 * `formatKg` — the single grams→kg display boundary.
 *
 * Dots are always drawn so a 1-point dataset (first ever session) is visible
 * — a dot-less line needs two points to render anything.
 *
 * SSR safety: Recharts' `ResponsiveContainer` measures the DOM and triggers
 * hydration mismatches when server-rendered. We follow the dashboard's
 * `mounted`-flag idiom (see `daily-spend-chart.tsx`): SSR and the first
 * client paint render a fixed-height placeholder; the chart mounts after the
 * client effect runs. Callers don't render this component with zero points —
 * the screen shows a "No sessions yet" card instead.
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "#/components/ui/chart";
import { formatKg } from "#/domain";

const CHART_HEIGHT = "h-[200px]";

/** One session's value: an x label (formatted date) + integer grams. */
export interface ProgressChartPoint {
	label: string;
	grams: number;
}

interface ProgressLineChartProps {
	title: ReactNode;
	/** Translated series name for the tooltip (e.g. "Best set" / "Volume"). */
	seriesLabel: string;
	/** Chronological (oldest → newest); at least one point. */
	points: ProgressChartPoint[];
}

export function ProgressLineChart({
	title,
	seriesLabel,
	points,
}: ProgressLineChartProps) {
	// Client-only mount gate — see the SSR note above.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	const rows = points.map((point) => ({
		label: point.label,
		kg: point.grams / 1000,
	}));

	const chartConfig = {
		kg: { color: "var(--chart-1)", label: seriesLabel },
	} satisfies ChartConfig;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{!mounted ? (
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
						<LineChart data={rows} margin={{ left: 4, right: 12, top: 8 }}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis
								dataKey="label"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								minTickGap={24}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								width={40}
								tickFormatter={(v) => formatKg(Math.round(Number(v) * 1000))}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										formatter={(value) => (
											<div className="flex w-full items-center justify-between gap-3">
												<span className="text-muted-foreground">
													{seriesLabel}
												</span>
												<span className="font-medium font-mono tabular-nums">
													{formatKg(Math.round(Number(value) * 1000))} kg
												</span>
											</div>
										)}
									/>
								}
							/>
							<Line
								dataKey="kg"
								type="monotone"
								stroke="var(--color-kg)"
								strokeWidth={2}
								// Dots stay on so a single-session dataset is visible.
								dot={{ r: 3, fill: "var(--color-kg)", strokeWidth: 0 }}
								isAnimationActive={false}
							/>
						</LineChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
