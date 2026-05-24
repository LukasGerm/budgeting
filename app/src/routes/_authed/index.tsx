import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ExpenseRow } from "#/components/expense-row";
import { SpendSheet } from "#/components/spend-sheet";
import {
	calculateAvailableToday,
	calculateMonthlyRemaining,
	type Expense,
	elapsedDaysInCycle,
	formatMonthlyStatus,
	getCurrentCycle,
	totalDaysInCycle,
} from "#/domain";
import { useBudget } from "#/hooks/use-budget";
import { startOfDay, useExpenses } from "#/hooks/use-expenses";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/")({
	// Server-first: prefetch budget + current-cycle expenses into the query
	// cache so the suspense queries below resolve from cache on first paint
	// (SSR), hydrating with no loading flash. `startOfDay` keys the expense
	// query identically to the component so the prefetched entry is hit.
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
			]),
		);
	},
	component: Home,
});

/** Newest first, by `createdAt`. */
function byNewest(a: Expense, b: Expense): number {
	return b.createdAt.getTime() - a.createdAt.getTime();
}

function Home() {
	const { user } = Route.useRouteContext();
	const now = new Date();
	const budget = useBudget();
	const expenses = useExpenses(now);

	// The _authed guard already redirected unbudgeted users to /onboarding,
	// so a missing budget here is an unexpected race. Render a thin state.
	if (!budget) {
		return (
			<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
				<p className="text-muted-foreground text-sm">Loading…</p>
			</div>
		);
	}

	const cycle = getCurrentCycle(now, budget.anchorDay);
	const available = calculateAvailableToday(budget, expenses, now);
	const monthlyLeft = calculateMonthlyRemaining(budget, expenses, now);
	const elapsed = elapsedDaysInCycle(cycle, now);
	const total = totalDaysInCycle(cycle);
	// Teaser: the 3 most recent expenses, newest first. A one-tap entry into
	// the full history; renders nothing when the cycle is empty.
	const recent = [...expenses].sort(byNewest).slice(0, 3);

	const dateLabel = new Intl.DateTimeFormat("de-DE", {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(now);

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-12 p-8">
			<header className="flex flex-col gap-1">
				<p className="text-muted-foreground text-sm">{dateLabel}</p>
				<h1 className="font-medium text-lg">Hi, {user.email}</h1>
			</header>

			<section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
				<p className="text-muted-foreground text-sm uppercase tracking-wide">
					Available today
				</p>
				<p
					className={`font-semibold text-6xl tabular-nums tracking-tight ${
						available.isNegative() ? "text-destructive" : ""
					}`}
				>
					{available.format()}
				</p>
				<p
					className={`text-sm ${
						monthlyLeft.isNegative()
							? "text-destructive"
							: "text-muted-foreground"
					}`}
				>
					{formatMonthlyStatus(
						monthlyLeft,
						budget.monthlyAmount,
						elapsed,
						total,
					)}
				</p>
			</section>

			{recent.length > 0 ? (
				<section className="flex flex-col gap-1">
					<Link
						to="/history"
						className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wide transition-colors hover:text-foreground"
					>
						<span>Recent</span>
						<span className="flex items-center gap-0.5">
							See all
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
