/**
 * Entry row presentation — the amount + optional note + relative date line
 * shared by the history list and the home teaser.
 *
 * `ExpenseRow` is pure presentation: it renders one entry given `now` (passed
 * in so the relative date stays clock-injected and testable). Spends show the
 * plain amount; adjustments are rendered distinctly with a user-facing sign and
 * a label — a **top-up** as `+X €` (a gain) and a **set-aside** as `−X €`
 * (walled off). Note the displayed sign is the *opposite* of the stored sign
 * (a top-up is stored negative), so the direction is resolved via the domain's
 * `adjustmentDirection` helper rather than read off the raw cents here.
 *
 * `EditableExpenseRow` wraps it in a tappable shadcn `Drawer` for the history
 * screen: tapping the row reopens the keypad sheet **pre-filled** with the
 * entry's amount, note and (for an adjustment) direction. Saving edits the
 * entry in place (never the day); delete lives inside the same sheet as a
 * secondary action.
 */

import { useReducer, useState } from "react";
import {
	EntryForm,
	entryFormReducer,
	initEntryForm,
} from "#/components/entry-form";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "#/components/ui/drawer";
import {
	adjustmentAmountCents,
	adjustmentDirection,
	type Expense,
	formatRelativeDate,
	Money,
} from "#/domain";

export function ExpenseRow({ expense, now }: { expense: Expense; now: Date }) {
	const isAdjustment = expense.kind === "adjustment";
	const direction = isAdjustment
		? adjustmentDirection(expense.amount.toCents())
		: null;

	// Spends show the plain amount; adjustments show a user-facing signed amount
	// (top-up "+", set-aside "−") over the magnitude.
	const magnitude = Money.fromCents(
		Math.abs(expense.amount.toCents()),
	).format();
	const amountText =
		direction === null
			? expense.amount.format()
			: `${direction === "topup" ? "+" : "−"}${magnitude}`;

	const label =
		direction === "topup"
			? "Top-up"
			: direction === "setaside"
				? "Set aside"
				: null;
	const secondary = [label, expense.note].filter(Boolean).join(" · ");

	return (
		<div className="flex items-baseline justify-between gap-3 py-3">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span
					className={`font-medium text-base tabular-nums ${
						isAdjustment ? "text-muted-foreground" : ""
					}`}
				>
					{amountText}
				</span>
				{secondary ? (
					<span className="truncate text-muted-foreground text-sm">
						{secondary}
					</span>
				) : null}
			</div>
			<span className="shrink-0 text-muted-foreground text-sm">
				{formatRelativeDate(expense.createdAt, now)}
			</span>
		</div>
	);
}

/** Pre-fill values for the edit form, derived from the stored entry. */
function editInitial(expense: Expense) {
	return {
		// `toDecimalString` is unsigned, so this is the magnitude for both kinds.
		amount: expense.amount.toDecimalString(),
		note: expense.note ?? "",
		kind: expense.kind,
		direction:
			expense.kind === "adjustment"
				? adjustmentDirection(expense.amount.toCents())
				: undefined,
	};
}

export function EditableExpenseRow({
	expense,
	now,
	onUpdate,
	onDelete,
	updatePending,
	deletePending,
}: {
	expense: Expense;
	now: Date;
	onUpdate: (input: { id: string; amountCents: number; note?: string }) => void;
	onDelete: (id: string) => void;
	updatePending?: boolean;
	deletePending?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [form, dispatch] = useReducer(
		entryFormReducer,
		editInitial(expense),
		initEntryForm,
	);

	const magnitudeCents = Money.fromDecimalString(form.amount).toCents();

	function handleOpenChange(next: boolean) {
		// Re-seed from the (possibly just-edited) entry each time we open so the
		// form always reflects the latest stored amount, note and direction.
		if (next) dispatch({ type: "reset", initial: editInitial(expense) });
		setOpen(next);
	}

	function handleSubmit() {
		if (magnitudeCents <= 0 || updatePending) return;
		const trimmedNote = form.note.trim();
		const amountCents =
			form.kind === "adjustment"
				? adjustmentAmountCents(form.direction, magnitudeCents)
				: magnitudeCents;
		onUpdate({
			id: expense.id,
			amountCents,
			note: trimmedNote.length > 0 ? trimmedNote : undefined,
		});
		setOpen(false);
	}

	return (
		<Drawer open={open} onOpenChange={handleOpenChange}>
			<DrawerTrigger asChild>
				<button
					type="button"
					className="w-full rounded-md px-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
				>
					<ExpenseRow expense={expense} now={now} />
				</button>
			</DrawerTrigger>
			<DrawerContent>
				<div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 pb-8">
					<DrawerHeader className="p-0">
						<DrawerTitle className="sr-only">Edit entry</DrawerTitle>
						<DrawerDescription className="sr-only">
							Change the amount or note and tap Save. The day can't be changed.
						</DrawerDescription>
					</DrawerHeader>

					<EntryForm
						state={form}
						dispatch={dispatch}
						amountCents={magnitudeCents}
						onSubmit={handleSubmit}
						submitLabel="Save"
						submittingLabel="Saving…"
						pending={!!updatePending}
						onDelete={() => onDelete(expense.id)}
						deletePending={deletePending}
					/>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
