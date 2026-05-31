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

import { Plural, Trans, useLingui } from "@lingui/react/macro";
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
	getRelativeDate,
	Money,
} from "#/domain";
import { useFormat } from "#/i18n/use-format";

export function ExpenseRow({ expense, now }: { expense: Expense; now: Date }) {
	const { formatMoney } = useFormat();
	const isAdjustment = expense.kind === "adjustment";
	const direction = isAdjustment
		? adjustmentDirection(expense.amount.toCents())
		: null;

	// Spends show the plain amount; adjustments show a user-facing signed amount
	// (top-up "+", set-aside "−") over the magnitude.
	const magnitude = formatMoney(Math.abs(expense.amount.toCents()));
	const amountText =
		direction === null
			? formatMoney(expense.amount.toCents())
			: `${direction === "topup" ? "+" : "−"}${magnitude}`;

	const rel = getRelativeDate(expense.createdAt, now);

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
				<ExpenseSecondaryLine direction={direction} note={expense.note} />
			</div>
			<span className="shrink-0 text-muted-foreground text-sm">
				{rel.kind === "today" ? (
					<Trans>today</Trans>
				) : rel.kind === "yesterday" ? (
					<Trans>yesterday</Trans>
				) : (
					<Plural value={rel.days} one="# day ago" other="# days ago" />
				)}
			</span>
		</div>
	);
}

/**
 * The secondary line under the amount: "Top-up · note" or "Set aside · note"
 * or just the note. Extracted so the translated labels live in a component
 * where `<Trans>` is natural and don't need to be assembled from raw strings.
 */
function ExpenseSecondaryLine({
	direction,
	note,
}: {
	direction: "topup" | "setaside" | null;
	note: string | null | undefined;
}) {
	const labelNode =
		direction === "topup" ? (
			<Trans>Top-up</Trans>
		) : direction === "setaside" ? (
			<Trans>Set aside</Trans>
		) : null;

	if (!labelNode && !note) return null;
	if (labelNode && !note) {
		return (
			<span className="truncate text-muted-foreground text-sm">
				{labelNode}
			</span>
		);
	}
	if (!labelNode && note) {
		return (
			<span className="truncate text-muted-foreground text-sm">{note}</span>
		);
	}
	return (
		<span className="truncate text-muted-foreground text-sm">
			{labelNode} · {note}
		</span>
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
	const { t } = useLingui();
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
						<DrawerTitle className="sr-only">
							<Trans>Edit entry</Trans>
						</DrawerTitle>
						<DrawerDescription className="sr-only">
							<Trans>
								Change the amount or note and tap Save. The day can't be
								changed.
							</Trans>
						</DrawerDescription>
					</DrawerHeader>

					<EntryForm
						state={form}
						dispatch={dispatch}
						amountCents={magnitudeCents}
						onSubmit={handleSubmit}
						submitLabel={t`Save`}
						submittingLabel={t`Saving…`}
						pending={!!updatePending}
						onDelete={() => onDelete(expense.id)}
						deletePending={deletePending}
					/>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
