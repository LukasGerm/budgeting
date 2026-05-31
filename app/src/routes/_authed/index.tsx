import { Trans } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ExpenseRow } from "#/components/expense-row";
import { SpendSheet } from "#/components/spend-sheet";
import { StreakChip } from "#/components/streak-chip";
import {
	calculateAvailableToday,
	calculateMonthlyRemaining,
	type Expense,
	elapsedDaysInCycle,
	getCurrentCycle,
	getMonthlyStatus,
	totalDaysInCycle,
} from "#/domain";
import { useBudget } from "#/hooks/use-budget";
import { startOfDay, useExpenses } from "#/hooks/use-expenses";
import { useStreaks } from "#/hooks/use-streaks";
import { useFormat } from "#/i18n/use-format";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/")({
	// Server-first: prefetch budget + current-cycle expenses into the query
	// cache so the suspense queries below resolve from cache on first paint
	// (SSR), hydrating with no loading flash. `startOfDay` keys the expense
	// query identically to the component so the prefetched entry is hit.
	//
	// `now` is computed here and returned so the component reads the *same*
	// value (via `useLoaderData`) on both the server render and client
	// hydration. Computing `new Date()` in the component instead diverges
	// between the server (UTC) and the browser (local TZ): a different expense
	// query key (so the SSR-prefetched data is missed) and different rendered
	// amounts/date → React hydration error #418 and a stale client UI.
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
				// The streak chip reads this via `useStreaks` (useSuspenseQuery); it
				// must be prefetched here like the others, or the un-cached suspense
				// query has nothing to resolve against during SSR and the route falls
				// through to TanStack Router's notFound ("<p>Not Found</p>").
				context.queryClient.ensureQueryData(
					context.trpc.expense.listForStreak.queryOptions({ now }),
				),
			]),
		);
		return { now };
	},
	component: Home,
});

/** Newest first, by `createdAt`. */
function byNewest(a: Expense, b: Expense): number {
	return b.createdAt.getTime() - a.createdAt.getTime();
}

function Home() {
	const { user } = Route.useRouteContext();
	const { formatMoney, formatDate } = useFormat();
	// From the loader (see above) so SSR and client hydration agree on `now`.
	const { now } = Route.useLoaderData();
	const budget = useBudget();
	const expenses = useExpenses(now);
	const streaks = useStreaks(now);

	// The _authed guard already redirected unbudgeted users to /onboarding,
	// so a missing budget here is an unexpected race. Render a thin state.
	if (!budget) {
		return (
			<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
				<p className="text-muted-foreground text-sm">
					<Trans>Loading…</Trans>
				</p>
			</div>
		);
	}

	const cycle = getCurrentCycle(now, budget.anchorDay);
	const available = calculateAvailableToday(budget, expenses, now);
	const monthlyLeft = calculateMonthlyRemaining(budget, expenses, now);
	const elapsed = elapsedDaysInCycle(cycle, now);
	const total = totalDaysInCycle(cycle);
	const monthlyStatus = getMonthlyStatus(
		monthlyLeft,
		budget.monthlyAmount,
		elapsed,
		total,
	);
	// Teaser: the 3 most recent expenses, newest first. A one-tap entry into
	// the full history; renders nothing when the cycle is empty.
	const recent = [...expenses].sort(byNewest).slice(0, 3);

	const dateLabel = formatDate(now, "long");

	const email = user.email;

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-12 p-8">
			<header className="flex items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<p className="text-muted-foreground text-sm">{dateLabel}</p>
					<h1 className="font-medium text-lg">
						<Trans>Hi, {email}</Trans>
					</h1>
				</div>
				{streaks ? <StreakChip streaks={streaks} /> : null}
			</header>

			<section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
				<p className="text-muted-foreground text-sm uppercase tracking-wide">
					<Trans>Available today</Trans>
				</p>
				<p
					className={`font-semibold text-6xl tabular-nums tracking-tight ${
						available.isNegative() ? "text-destructive" : ""
					}`}
				>
					{formatMoney(available.toCents())}
				</p>
				<p
					className={`text-sm ${
						monthlyLeft.isNegative()
							? "text-destructive"
							: "text-muted-foreground"
					}`}
				>
					{monthlyStatus.kind === "over_budget"
						? (() => {
								const money = formatMoney(monthlyStatus.remainingCents);
								return <Trans>{money} over budget</Trans>;
							})()
						: (() => {
								const remaining = formatMoney(monthlyStatus.remainingCents);
								const budget = formatMoney(monthlyStatus.budgetCents);
								const elapsedDays = monthlyStatus.elapsedDays;
								const totalDays = monthlyStatus.totalDays;
								return (
									<Trans>
										{remaining} left of {budget} · day {elapsedDays} of{" "}
										{totalDays}
									</Trans>
								);
							})()}
				</p>
			</section>

			{recent.length > 0 ? (
				<section className="flex flex-col gap-1">
					<Link
						to="/history"
						className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wide transition-colors hover:text-foreground"
					>
						<span>
							<Trans>Recent</Trans>
						</span>
						<span className="flex items-center gap-0.5">
							<Trans>See all</Trans>
							<ChevronRight className="size-3.5" aria-hidden="true" />
						</span>
					</Link>
					<div className="flex flex-col divide-y">
						{recent.map((expense) => (
							<ExpenseRow key={expense.id} expense={expense} now={now} />
						))}
					</div>
				</section>
			) : null}

			<SpendSheet />
		</div>
	);
}
