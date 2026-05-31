/**
 * MonthlyTrendChart — one bar per recent cycle, sized to that cycle's **net**
 * total, with a reference line at the monthly budget so the user sees which
 * cycles came in under or over.
 *
 * Reads a `CycleTotal[]` (see `domain/dashboard.ts`) ordered newest → oldest
 * (as `getRecentCycles`/`cycleTotals` yield). For display we reverse it so the
 * bars read **oldest → newest, left → right** like a calendar. `netCents` is
 * integer **cents** — the tooltip and reference label convert back via
 * `useFormat().formatMoney(...)`. Each bar's label is the cycle's month derived
 * from `cycle.start` via `useFormat().formatDate(date, "short")` (locale-aware).
 *
 * This is a NET chart (it includes adjustments), matching the pace line and the
 * monthly budget it's compared against — not the SPEND-only daily-spend chart.
 *
 * Thin-data rule — a cycle "has data" when it contains **at least one entry**
 * (`entryCount > 0`), NOT merely a non-zero net: a cycle where a spend is
 * cancelled by a top-up nets to 0 yet clearly has data, so we key off the entry
 * count. Until **2 or more** cycles have data, a single month of bars carries no
 * trend, so we render a friendly placeholder instead of the chart.
 *
 * SSR safety: Recharts' `ResponsiveContainer` measures the DOM and reliably
 * triggers hydration mismatches (React #418) when server-rendered. We follow the
 * codebase's `mounted`-flag idiom (see `daily-spend-chart.tsx`): SSR and the
 * first client paint render a fixed-height placeholder, and the chart mounts only
 * after the client effect runs — no layout shift, no hydration error.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
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
import type { CycleTotal, Money } from "#/domain";
import { useFormat } from "#/i18n/use-format";

const CHART_HEIGHT = "h-[200px]";

/** A cycle needs at least this many cycles-with-data before the trend is shown. */
const MIN_CYCLES_WITH_DATA = 2;

// Label is translated at render time.
const chartConfigBase = {
	netCents: { color: "var(--chart-1)" },
} satisfies ChartConfig;

interface MonthlyTrendChartProps {
	/** Per-cycle net totals, newest → oldest (the component reverses for display). */
	totals: CycleTotal[];
	/** The monthly budget — drives the reference line. */
	monthlyAmount: Money;
}

/** A bar row: the cycle's net cents plus a month label derived from its start. */
interface TrendRow {
	label: string;
	netCents: number;
}

function toRows(
	totals: CycleTotal[],
	formatDate: (date: Date, style: "short") => string,
): TrendRow[] {
	// `totals` is newest → oldest; reverse so bars read oldest → newest L→R.
	return [...totals].reverse().map((t) => ({
		label: formatDate(t.cycle.start, "short"),
		netCents: t.netCents,
	}));
}

export function MonthlyTrendChart({
	totals,
	monthlyAmount,
}: MonthlyTrendChartProps) {
	// Client-only mount gate — see the SSR note above (matches daily-spend-chart.tsx).
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	// Capture format fns and translations at the top of the component — do NOT
	// call hooks inside Recharts formatter callbacks.
	const { formatMoney, formatDate } = useFormat();
	const { t } = useLingui();
	const cyclesWithData = totals.filter((tot) => tot.entryCount > 0).length;
	const enoughData = cyclesWithData >= MIN_CYCLES_WITH_DATA;
	const rows = toRows(totals, formatDate);
	const monthlyCents = monthlyAmount.toCents();

	const chartConfig = {
		netCents: { ...chartConfigBase.netCents, label: t`Total (net)` },
	} satisfies ChartConfig;

	// Pin the Y-axis so the budget reference line is always on-screen. Recharts
	// auto-scales to the tallest bar, so when every cycle's net is under budget
	// the dashed `monthlyCents` line would be clipped off the top and dropped
	// entirely. Span 0..max(tallest bar, budget) with a little headroom so the
	// reference line never sits flush against the chart's top edge.
	const maxNetCents = rows.reduce((max, d) => Math.max(max, d.netCents), 0);
	const yMax = Math.ceil(Math.max(maxNetCents, monthlyCents) * 1.1);

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<Trans>Monthly totals</Trans>
				</CardTitle>
				<CardDescription>
					<Trans>
						Net total per cycle vs. your monthly budget (the dashed line).
					</Trans>
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!enoughData ? (
					// Thin-data rule: fewer than two cycles with any entries — no trend yet.
					<div
						className={`${CHART_HEIGHT} flex w-full items-center justify-center text-center text-muted-foreground text-sm`}
					>
						<Trans>
							Your monthly trend will appear once you've completed a couple of
							cycles.
						</Trans>
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
						<BarChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis
								dataKey="label"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
							/>
							{/* Hidden, but with an explicit domain so the budget reference
							    line is always inside the axis range (see `yMax` above). */}
							<YAxis hide domain={[0, yMax]} />
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										formatter={(value) => (
											<div className="flex w-full items-center justify-between gap-3">
												<span className="text-muted-foreground">
													<Trans>Total (net)</Trans>
												</span>
												<span className="font-medium font-mono tabular-nums">
													{formatMoney(Number(value))}
												</span>
											</div>
										)}
									/>
								}
							/>
							{/* Budget reference line: which cycles landed under/over. */}
							<ReferenceLine
								y={monthlyCents}
								stroke="var(--muted-foreground)"
								strokeDasharray="5 4"
								label={{
									value: formatMoney(monthlyAmount.toCents()),
									position: "insideTopRight",
									fill: "var(--muted-foreground)",
									fontSize: 11,
								}}
							/>
							<Bar
								dataKey="netCents"
								fill="var(--color-netCents)"
								radius={[2, 2, 0, 0]}
								isAnimationActive={false}
							/>
						</BarChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
