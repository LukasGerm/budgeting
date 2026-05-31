/**
 * SpendSheet — the "I just spent money" loop (and one-off cycle adjustments)
 * in a bottom sheet.
 *
 * A shadcn `Drawer` (vaul, `direction="bottom"`) holds the keypad form. The
 * sheet owns the `open` state and the in-progress fields (via the shared
 * `EntryForm` reducer). A Spend / Adjust toggle picks what's being entered;
 * on submit the keypad's decimal string becomes integer cents, and for an
 * adjustment the stored *signed* amount is derived via `adjustmentAmountCents`
 * (top-up negative, set-aside positive). The `useAddExpense` mutation
 * invalidates the expenses query so the home daily/monthly numbers recompute
 * once the sheet closes.
 *
 * On a successful add we close the sheet and raise an undo toast. The toast
 * fires from the mutation's `onSuccess`, so it only appears once the server has
 * confirmed the create and handed back the new id — undo is then a plain
 * delete-by-id with no race against the create. On a network failure we keep
 * the sheet open with the entered values intact.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { Plus } from "lucide-react";
import { useReducer, useState } from "react";
import { toast } from "sonner";
import {
	EntryForm,
	entryFormReducer,
	initEntryForm,
} from "#/components/entry-form";
import { Button } from "#/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "#/components/ui/drawer";
import { adjustmentAmountCents, Money } from "#/domain";
import { useAddExpense, useDeleteExpense } from "#/hooks/use-expenses";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";
import { useFormat } from "#/i18n/use-format";

export function SpendSheet() {
	const { formatMoney } = useFormat();
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();
	const [open, setOpen] = useState(false);
	const [form, dispatch] = useReducer(
		entryFormReducer,
		undefined,
		initEntryForm,
	);
	const addExpense = useAddExpense();
	const deleteExpense = useDeleteExpense();

	// The keypad value is always an unsigned magnitude; the sign comes from the
	// adjustment direction below.
	const magnitudeCents = Money.fromDecimalString(form.amount).toCents();

	function handleOpenChange(next: boolean) {
		setOpen(next);
		// Clear values when the sheet fully closes so the next open starts fresh.
		if (!next) dispatch({ type: "reset" });
	}

	function handleSubmit() {
		if (magnitudeCents <= 0 || addExpense.isPending) return;
		const trimmedNote = form.note.trim();
		const note = trimmedNote.length > 0 ? trimmedNote : undefined;
		const isAdjustment = form.kind === "adjustment";
		const amountCents = isAdjustment
			? adjustmentAmountCents(form.direction, magnitudeCents)
			: magnitudeCents;
		const magnitudeLabel = formatMoney(magnitudeCents);
		const toastText = !isAdjustment
			? t`Logged ${magnitudeLabel}`
			: form.direction === "topup"
				? t`Added ${magnitudeLabel}`
				: t`Set aside ${magnitudeLabel}`;

		addExpense.mutate(
			{ kind: form.kind, amountCents, note },
			{
				onSuccess: (created) => {
					// Close (which resets) only on success; the daily/monthly numbers
					// recompute as the invalidated expenses query refetches.
					handleOpenChange(false);
					// Raise the undo toast. We have the confirmed id here, so "Undo" is a
					// plain delete-by-id with no race against the create.
					const toastId = toast(toastText, {
						duration: 5000,
						action: {
							label: t`Undo`,
							onClick: () => {
								deleteExpense.mutate({ id: created.id });
								toast.dismiss(toastId);
							},
						},
					});
				},
				onError: (e) => {
					// Keep the sheet open with the entered values preserved.
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	return (
		<Drawer open={open} onOpenChange={handleOpenChange}>
			<DrawerTrigger asChild>
				<Button
					size="icon"
					className="fixed right-6 bottom-20 z-40 size-16 rounded-full shadow-lg"
					aria-label={t`Log a spend`}
				>
					<Plus className="size-7" />
				</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 pb-8">
					<DrawerHeader className="p-0">
						<DrawerTitle className="sr-only">
							<Trans>Log a spend or adjust</Trans>
						</DrawerTitle>
						<DrawerDescription className="sr-only">
							<Trans>
								Choose Spend or Adjust, enter an amount and an optional note,
								then confirm.
							</Trans>
						</DrawerDescription>
					</DrawerHeader>

					<EntryForm
						state={form}
						dispatch={dispatch}
						amountCents={magnitudeCents}
						onSubmit={handleSubmit}
						submitLabel={form.kind === "adjustment" ? t`Add` : t`Log`}
						submittingLabel={t`Saving…`}
						pending={addExpense.isPending}
						showKindToggle
					/>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
