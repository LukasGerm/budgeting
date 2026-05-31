/**
 * History — every expense in the *current cycle*, newest first.
 *
 * The list reuses `useExpenses`, which already returns only the current
 * cycle's expenses (the server bounds the query by the cycle containing
 * `now`), so cycle rollover needs no special-casing: a new day produces a new
 * query key and the list shifts to the new cycle on its own.
 *
 * Tapping a row reopens the keypad sheet pre-filled to edit the entry; saving
 * fires `useUpdateExpense` and the in-sheet delete fires `useDeleteExpense`.
 * Both invalidate the shared expenses query so this list and the home
 * daily/monthly numbers recompute from the new total.
 */

import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { EditableExpenseRow } from "#/components/expense-row";
import type { Expense } from "#/domain";
import {
	startOfDay,
	useDeleteExpense,
	useExpenses,
	useUpdateExpense,
} from "#/hooks/use-expenses";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/history")({
	// `now` is returned so the component reads the same value on the server
	// render and client hydration (see the note in `_authed/index.tsx`): a
	// component-side `new Date()` diverges between server (UTC) and browser
	// (local TZ) → mismatched query key + hydration error #418.
	loader: async ({ context }) => {
		const now = startOfDay(new Date());
		await withLoginRedirect(() =>
			context.queryClient.ensureQueryData(
				context.trpc.expense.listForCurrentCycle.queryOptions({ now }),
			),
		);
		return { now };
	},
	component: HistoryPage,
});

/** Newest first, by `createdAt`. */
function byNewest(a: Expense, b: Expense): number {
	return b.createdAt.getTime() - a.createdAt.getTime();
}

function HistoryPage() {
	const { now } = Route.useLoaderData();
	const expenses = [...useExpenses(now)].sort(byNewest);
	const updateExpense = useUpdateExpense();
	const deleteExpense = useDeleteExpense();
	const getErrorMessage = useErrorMessage();

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header>
				<h1 className="font-medium text-lg">
					<Trans>History</Trans>
				</h1>
				<p className="text-muted-foreground text-sm">
					<Trans>This cycle's expenses</Trans>
				</p>
			</header>

			{expenses.length === 0 ? (
				<EmptyState />
			) : (
				<ul className="flex flex-col divide-y">
					{expenses.map((expense) => (
						<li key={expense.id}>
							<EditableExpenseRow
								expense={expense}
								now={now}
								onUpdate={(input) =>
									updateExpense.mutate(input, {
										onError: (e) =>
											toast.error(
												getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"),
											),
									})
								}
								onDelete={(id) =>
									deleteExpense.mutate(
										{ id },
										{
											onError: (e) =>
												toast.error(
													getErrorMessage(
														errorCodeFromTRPC(e) ?? "SAVE_FAILED",
													),
												),
										},
									)
								}
								updatePending={updateExpense.isPending}
								deletePending={deleteExpense.isPending}
							/>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
			<p className="font-medium">
				<Trans>No expenses yet this cycle</Trans>
			</p>
			<p className="text-muted-foreground text-sm">
				<Trans>Anything you log will show up here.</Trans>
			</p>
		</div>
	);
}
