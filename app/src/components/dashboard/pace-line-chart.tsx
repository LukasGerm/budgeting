/**
 * PaceLineChart — the Dashboard's hero chart: cumulative **net** spend (the
 * "actual" line) tracked against a straight-line ideal across the elapsed days
 * of the current cycle.
 *
 * Reads a `PacePoint[]` (see `domain/dashboard.ts`) whose money fields are
 * integer **cents** — the tooltip converts each back to a euro string via
 * `Money.fromCents(v).format()`. The series already stops at `now`, so the chart
 * never draws into the future.
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
import { Money, type PacePoint } from "#/domain";

/**
 * Compact Y-axis tick label for integer-cent values.
 *
 * Rules (using de-DE `,` as decimal separator):
 *   |cents| <  100_000  (< €1 000) → `€N`           e.g. `€999`
 *   |cents| < 1_000_000 (< €10 000) → `€N,Dk`       e.g. `€1,2k`
 *   |cents| ≥ 1_000_000 (≥ €10 000) → `€Nk`         e.g. `€12k`
 *
 * Negatives are handled symmetrically with a leading `-` before `€`.
 */
export function formatAxisCents(cents: number): string {
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(cents);
	// Convert to whole euros (truncate, not round, to stay conservative).
	const euros = Math.trunc(abs / 100);

	if (abs < 100_000) {
		// Under €1 000: show whole euros, no k suffix.
		return `${sign}€${euros}`;
	}

	const thousands = abs / 100_000; // in units of €1 000
	if (abs < 1_000_000) {
		// €1 000 – €9 999: one decimal place + k, using comma separator.
		const formatted = thousands.toFixed(1).replace(".", ",");
		return `${sign}€${formatted}k`;
	}

	// €10 000+: whole thousands + k, no decimal.
	// Note: the €9 999→€10 000 seam (€10,0k vs €10k) is unreachable in practice
	// because Recharts generates "nice" round axis ticks that skip that boundary.
	// Truncation (not rounding) is intentional — matches divideIntFloor/toDecimalString
	// conservative behaviour in the domain layer; do not change to Math.round.
	const wholeThousands = Math.trunc(abs / 100_000);
	return `${sign}€${wholeThousands}k`;
}

const CHART_HEIGHT = "h-[220px]";

const chartConfig = {
	actualNet: {
		label: "Spent (net)",
		color: "var(--chart-2)",
	},
	idealNet: {
		label: "Ideal pace",
		color: "var(--muted-foreground)",
	},
	// Drives the over-pace shading colour (theme-aware red).
	over: {
		label: "Over pace",
		color: "var(--destructive)",
	},
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

	const rows = toRows(series);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Pace this cycle</CardTitle>
				<CardDescription>
					Net spending vs. the steady daily pace
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
						Not enough data yet — come back tomorrow.
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
								tickFormatter={(v) => `Day ${v}`}
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
										labelFormatter={(label) => `Day ${label}`}
										formatter={(value, name) => (
											<div className="flex w-full items-center justify-between gap-3">
												<span className="text-muted-foreground">
													{chartConfig[name as keyof typeof chartConfig]
														?.label ?? name}
												</span>
												<span className="font-medium font-mono tabular-nums">
													{Money.fromCents(Number(value)).format()}
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
