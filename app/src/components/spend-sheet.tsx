/**
 * SpendSheet — the "I just spent money" loop in a bottom sheet.
 *
 * A shadcn `Drawer` (vaul, `direction="bottom"`) holds the spend form. The
 * sheet owns the entered-amount *string* the keypad builds and the optional
 * note; on submit it converts the decimal string to integer cents via the
 * pure `Money.fromDecimalString` helper and calls the `useAddExpense`
 * mutation. The mutation invalidates the expenses query, so the home daily
 * and monthly numbers recompute from the new total once the sheet closes.
 *
 * The keypad is our custom `NumericKeypad` (no OS keyboard). The amount
 * preview at the top formats the live string so the user sees "12,50 €" while
 * typing. On a network failure we surface a toast and keep the sheet open
 * with the entered values intact (offline behaviour is slice 9).
 *
 * On a successful log we close the sheet and raise an undo toast. The toast
 * fires from the add mutation's `onSuccess`, so it only appears once the
 * server has confirmed the create and handed back the new id — which means by
 * the time the "Undo" action is tappable the expense definitely exists, and
 * undo is a plain delete-by-id. Tapping "Undo" deletes that expense and
 * dismisses the toast; otherwise it auto-dismisses after ~5s.
 */

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type KeypadKey, NumericKeypad } from "#/components/numeric-keypad";
import { Button } from "#/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "#/components/ui/drawer";
import { Input } from "#/components/ui/input";
import { Money } from "#/domain";
import { useAddExpense, useDeleteExpense } from "#/hooks/use-expenses";

/**
 * Apply a single keypad key to the current amount string, returning the next
 * string. Pure: no side effects, easy to reason about. Rejects a second dot
 * and a third fractional digit so the string is always parseable.
 */
function applyKey(current: string, key: KeypadKey): string {
	if (key === "backspace") {
		return current.slice(0, -1);
	}
	if (key === ".") {
		if (current.includes(".")) return current;
		// Leading "." becomes "0." so the preview reads naturally.
		return current === "" ? "0." : `${current}.`;
	}
	// A digit.
	const dotIndex = current.indexOf(".");
	if (dotIndex !== -1 && current.length - dotIndex > 2) {
		// Already two fractional digits — ignore further input.
		return current;
	}
	// Avoid a leading run of zeros like "007"; a single "0" is fine.
	if (current === "0") {
		return key;
	}
	return current + key;
}

/** Format the live amount string for the preview at the top of the sheet. */
function previewAmount(amount: string): string {
	return Money.fromDecimalString(amount).format();
}

export function SpendSheet() {
	const [open, setOpen] = useState(false);
	const [amount, setAmount] = useState("");
	const [note, setNote] = useState("");
	const [noteExpanded, setNoteExpanded] = useState(false);
	const addExpense = useAddExpense();
	const deleteExpense = useDeleteExpense();

	const amountCents = Money.fromDecimalString(amount).toCents();
	const canLog = amountCents > 0 && !addExpense.isPending;

	function reset() {
		setAmount("");
		setNote("");
		setNoteExpanded(false);
	}

	function handleOpenChange(next: boolean) {
		setOpen(next);
		// Clear values when the sheet fully closes so the next open starts fresh.
		if (!next) reset();
	}

	function handleKey(key: KeypadKey) {
		setAmount((current) => applyKey(current, key));
	}

	function handleSubmit() {
		if (!canLog) return;
		const trimmedNote = note.trim();
		addExpense.mutate(
			{
				amountCents,
				note: trimmedNote.length > 0 ? trimmedNote : undefined,
			},
			{
				onSuccess: (created) => {
					// Close (which resets) only on success; the daily/monthly numbers
					// recompute as the invalidated expenses query refetches.
					setOpen(false);
					reset();
					// Raise the undo toast. We have the confirmed expense id here, so
					// "Undo" is a plain delete-by-id with no race against the create.
					const toastId = toast(`Logged ${created.amount.format()}`, {
						duration: 5000,
						action: {
							label: "Undo",
							onClick: () => {
								deleteExpense.mutate({ id: created.id });
								toast.dismiss(toastId);
							},
						},
					});
				},
				onError: () => {
					// Keep the sheet open with the entered values preserved.
					toast.error("Couldn't log that spend. Check your connection.");
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
					aria-label="Log a spend"
				>
					<Plus className="size-7" />
				</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 pb-8">
					<DrawerHeader className="p-0">
						<DrawerTitle className="sr-only">Log a spend</DrawerTitle>
						<DrawerDescription className="sr-only">
							Enter an amount and an optional note, then tap Log.
						</DrawerDescription>
						<p className="text-center font-semibold text-5xl tabular-nums tracking-tight">
							{previewAmount(amount)}
						</p>
					</DrawerHeader>

					{noteExpanded ? (
						<Input
							autoFocus
							value={note}
							onChange={(e) => setNote(e.target.value)}
							placeholder="Note (optional)"
							maxLength={280}
						/>
					) : (
						<Button
							type="button"
							variant="ghost"
							className="text-muted-foreground"
							onClick={() => setNoteExpanded(true)}
						>
							{note.trim().length > 0 ? note : "Add a note"}
						</Button>
					)}

					<NumericKeypad onKey={handleKey} />

					<Button
						type="button"
						size="lg"
						className="h-14 w-full text-base"
						disabled={!canLog}
						onClick={handleSubmit}
					>
						{addExpense.isPending ? "Logging…" : "Log"}
					</Button>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
