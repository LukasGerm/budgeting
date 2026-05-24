/**
 * Expense row presentation — the amount + optional note + relative date line
 * shared by the history list and the home teaser.
 *
 * `ExpenseRow` is pure presentation: it renders one expense given `now`
 * (passed in so the relative date stays clock-injected and testable). It does
 * no I/O and knows nothing about deletion.
 *
 * `DeletableExpenseRow` wraps it in a tappable shadcn `AlertDialog` for the
 * history screen: tapping the row opens "Delete this expense?"; confirming
 * calls back to the parent (which fires `useDeleteExpense`). The note is shown
 * only when present — no placeholder for noteless expenses (per the spec).
 */

import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { type Expense, formatRelativeDate } from "#/domain";

export function ExpenseRow({ expense, now }: { expense: Expense; now: Date }) {
	return (
		<div className="flex items-baseline justify-between gap-3 py-3">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="font-medium text-base tabular-nums">
					{expense.amount.format()}
				</span>
				{expense.note ? (
					<span className="truncate text-muted-foreground text-sm">
						{expense.note}
					</span>
				) : null}
			</div>
			<span className="shrink-0 text-muted-foreground text-sm">
				{formatRelativeDate(expense.createdAt, now)}
			</span>
		</div>
	);
}

export function DeletableExpenseRow({
	expense,
	now,
	onDelete,
	disabled,
}: {
	expense: Expense;
	now: Date;
	onDelete: (id: string) => void;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<button
				type="button"
				className="w-full rounded-md px-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
				onClick={() => setOpen(true)}
			>
				<ExpenseRow expense={expense} now={now} />
			</button>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete this expense?</AlertDialogTitle>
					<AlertDialogDescription>
						{expense.amount.format()}
						{expense.note ? ` · ${expense.note}` : ""}. This can't be undone and
						your daily and monthly numbers will update.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={disabled}
						onClick={() => {
							onDelete(expense.id);
							setOpen(false);
						}}
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
