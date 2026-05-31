/**
 * PaceLineChart — the Dashboard's hero chart: cumulative **net** spend (the
 * "actual" line) tracked against a straight-line ideal across the elapsed days
 * of the current cycle.
 *
 * Reads a `PacePoint[]` (see `domain/dashboard.ts`) whose money fields are
 * integer **cents** — the tooltip converts each back to a euro string via
 * `useFormat().formatMoney(...)`. The series already stops at `now`, so the
 * chart never draws into the future.
 *
 * Over-pace emphasis: wherever the actual net is *above* the ideal (spending
 * faster than the straight-line pace) a red area is shaded between the two
 * lines. The emphasis colour comes from the theme's `--destructive` token (via
 * the chart config's `--color-over`), so it tracks dark mode rather than a
 * hardcoded hex.
 *
 * SSR safety: Recharts' `ResponsiveContainer` measures the DOM and reliably
 * triggers hydration mismatches (React #418) when server-rendered. We follow
 * the codebase's `mounted`-flag idiom (see `streak-badge.tsx`): SSR and the
 * first client paint render a fixed-height placeholder, and the chart mounts
 * only after the client effect runs — no layout shift, no hydration error.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
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
import type { PacePoint } from "#/domain";
import { useFormat } from "#/i18n/use-format";

const CHART_HEIGHT = "h-[220px]";

// Chart config labels are translated at render time via useLingui().
// The object is stable (no locale-reactive updates needed) since Recharts
// reads these once per render and the whole component re-renders on locale change.
const chartConfigBase = {
	actualNet: { color: "var(--chart-2)" },
	idealNet: { color: "var(--muted-foreground)" },
	over: { color: "var(--destructive)" },
} satisfies ChartConfig;

interface PaceLineChartProps {
	series: PacePoint[];
}

/** A point augmented with the over-pace band (the amount actual exceeds ideal). */
interface PaceRow extends PacePoint {
	/** `actualNet` when over the ideal pace, else `null` (no shading drawn). */
	over: number | null;
}

function toRows(series: PacePoint[]): PaceRow[] {
	return series.map((p) => ({
		...p,
		over: p.actualNet > p.idealNet ? p.actualNet : null,
	}));
}

export function PaceLineChart({ series }: PaceLineChartProps) {
	// Client-only mount gate — see the SSR note above (matches streak-badge.tsx).
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	// Capture format fns and translations at the top of the component — do NOT
	// call hooks inside Recharts formatter callbacks.
	const { formatMoney, formatAxisCents } = useFormat();
	const { t } = useLingui();
	const rows = toRows(series);

	const chartConfig = {
		actualNet: { ...chartConfigBase.actualNet, label: t`Spent (net)` },
		idealNet: { ...chartConfigBase.idealNet, label: t`Ideal pace` },
		over: { ...chartConfigBase.over, label: t`Over pace` },
	} satisfies ChartConfig;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<Trans>Pace this cycle</Trans>
				</CardTitle>
				<CardDescription>
					<Trans>Net spending vs. the steady daily pace</Trans>
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!mounted ? (
					// SSR / pre-mount placeholder: same height, no chart, no flash.
					<div
						className={`${CHART_HEIGHT} w-full animate-pulse rounded-md bg-muted/30`}
						aria-hidden="true"
					/>
				) : rows.length < 2 ? (
					// One point is not enough to draw a line — show a thin affordance.
					<div
						className={`${CHART_HEIGHT} flex w-full items-center justify-center text-center text-muted-foreground text-sm`}
					>
						<Trans>Not enough data yet — come back tomorrow.</Trans>
					</div>
				) : (
					<ChartContainer
						config={chartConfig}
						className={`${CHART_HEIGHT} w-full`}
					>
						<ComposedChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" />
							<XAxis
								dataKey="day"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								tickFormatter={(v) => t`Day ${v}`}
								minTickGap={24}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								width={56}
								tickFormatter={(v) => formatAxisCents(Number(v))}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(label) => t`Day ${label}`}
										formatter={(value, name) => (
											<div className="flex w-full items-center justify-between gap-3">
												<span className="text-muted-foreground">
													{chartConfig[name as keyof typeof chartConfig]
														?.label ?? name}
												</span>
												<span className="font-medium font-mono tabular-nums">
													{formatMoney(Number(value))}
												</span>
											</div>
										)}
									/>
								}
							/>
							{/* Over-pace band: shaded only where actual exceeds ideal. */}
							<Area
								dataKey="over"
								type="monotone"
								fill="var(--color-over)"
								fillOpacity={0.2}
								stroke="var(--color-over)"
								strokeWidth={0}
								connectNulls={false}
								isAnimationActive={false}
							/>
							<Line
								dataKey="idealNet"
								type="monotone"
								stroke="var(--color-idealNet)"
								strokeWidth={2}
								strokeDasharray="5 4"
								dot={false}
								isAnimationActive={false}
							/>
							<Line
								dataKey="actualNet"
								type="monotone"
								stroke="var(--color-actualNet)"
								strokeWidth={2}
								dot={false}
								isAnimationActive={false}
							/>
						</ComposedChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
