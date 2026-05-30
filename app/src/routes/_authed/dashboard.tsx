/**
 * Dashboard — temporal insights for the current cycle.
 *
 * A present-first vertical card stack in the same container as Home. This slice
 * renders only the headline card (total spent / average per day / days left);
 * later slices append more widgets to the stack.
 *
 * The loader mirrors `_authed/index.tsx`: it prefetches the *same* budget +
 * current-cycle expense queries Home warms, so `useDashboard` resolves from the
 * SSR cache on first paint with no loading flash and no new server procedure.
 * `now` is returned so the component reads the same value on the server render
 * and client hydration (see the note in `_authed/index.tsx`).
 */

import { createFileRoute } from "@tanstack/react-router";
import { BiggestSpends } from "#/components/dashboard/biggest-spends";
import { DailySpendChart } from "#/components/dashboard/daily-spend-chart";
import { HeadlineStats } from "#/components/dashboard/headline-stats";
import { MonthlyTrendChart } from "#/components/dashboard/monthly-trend-chart";
import { PaceLineChart } from "#/components/dashboard/pace-line-chart";
import { ProjectionCaption } from "#/components/dashboard/projection-caption";
import { VsLastDelta } from "#/components/dashboard/vs-last-delta";
import { TREND_CYCLE_COUNT, useCycleTotals } from "#/hooks/use-cycle-totals";
import { useDashboard } from "#/hooks/use-dashboard";
import { startOfDay } from "#/hooks/use-expenses";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/dashboard")({
	loader: async ({ context }) => {
		const now = startOfDay(new Date());
		await withLoginRedirect(() =>
			Promise.all([
				context.queryClient.ensureQueryData(
					context.trpc.budget.get.queryOptions(),
				),
				context.queryClient.ensureQueryData(
					context.trpc.expense.listForCurrentCycle.queryOptions({ now }),
				),
				// SSR-prefetch the cross-cycle list so the monthly trend paints from
				// cache on first render (same `now` keys it for the client too).
				context.queryClient.ensureQueryData(
					context.trpc.expense.listForCycles.queryOptions({
						now,
						count: TREND_CYCLE_COUNT,
					}),
				),
			]),
		);
		return { now };
	},
	component: DashboardPage,
});

function DashboardPage() {
	// From the loader so SSR and client hydration agree on `now`.
	const { now } = Route.useLoaderData();
	const dashboard = useDashboard(now);
	const cycleTotals = useCycleTotals(now);

	// The _authed guard already redirected unbudgeted users to /onboarding, so a
	// missing budget here is an unexpected race. Render a thin state.
	if (!dashboard) {
		return (
			<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
				<p className="text-muted-foreground text-sm">Loading…</p>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header>
				<h1 className="font-medium text-lg">Dashboard</h1>
				<p className="text-muted-foreground text-sm">This cycle at a glance</p>
			</header>

			<HeadlineStats summary={dashboard.summary} />
			<PaceLineChart series={dashboard.paceSeries} />
			<ProjectionCaption projection={dashboard.projection} />
			<DailySpendChart buckets={dashboard.dailySpend.buckets} />
			{cycleTotals && (
				<>
					<VsLastDelta comparison={cycleTotals.comparison} />
					<MonthlyTrendChart
						totals={cycleTotals.totals}
						monthlyAmount={cycleTotals.monthlyAmount}
					/>
				</>
			)}
			<BiggestSpends spends={dashboard.biggest} />
		</div>
	);
}
