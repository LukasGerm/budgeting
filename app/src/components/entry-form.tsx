/**
 * EntryForm — the shared body of the keypad sheet, used to **add** a new entry
 * (from the home FAB) and to **edit** an existing one (from a history row).
 *
 * An entry is either a **spend** or a one-off **adjustment** to the cycle's
 * available pool. In add mode a Spend / Adjust toggle (defaulting to Spend)
 * switches between the two; in Adjust mode a +/− control picks **top-up**
 * (a reimbursement — raises available) or **set-aside** (wall money off —
 * lowers available). The keypad always builds an unsigned *magnitude*; the
 * parent maps `(kind, direction, magnitude)` to a stored signed amount via the
 * domain's `adjustmentAmountCents` (the one place the sign convention lives).
 *
 * It is pure presentation over a small reducer: the parent sheet owns the
 * `open` state and the mutation wiring; this component owns only the in-progress
 * fields. Keeping them in one reducer (rather than several `useState`s) makes
 * "reset on close" / "pre-fill on edit" a single dispatch.
 *
 * In edit mode (`onDelete` provided) a destructive secondary action appears
 * under the confirm button, reusing the delete-confirm dialog so there is one
 * consistent place to correct or remove an entry.
 */

import { type Dispatch, useState } from "react";
import { type KeypadKey, NumericKeypad } from "#/components/numeric-keypad";
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
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { type AdjustmentDirection, type EntryKind, Money } from "#/domain";

/**
 * Apply a single keypad key to the current amount string, returning the next
 * string. Pure: no side effects, easy to reason about. Rejects a second dot
 * and a third fractional digit so the string is always parseable.
 */
export function applyKey(current: string, key: KeypadKey): string {
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

export interface EntryFormState {
	readonly amount: string;
	readonly note: string;
	readonly noteExpanded: boolean;
	readonly kind: EntryKind;
	readonly direction: AdjustmentDirection;
}

export type EntryFormAction =
	| { type: "key"; key: KeypadKey }
	| { type: "note"; value: string }
	| { type: "expandNote" }
	| { type: "kind"; kind: EntryKind }
	| { type: "direction"; direction: AdjustmentDirection }
	| {
			type: "reset";
			initial?: {
				amount?: string;
				note?: string;
				kind?: EntryKind;
				direction?: AdjustmentDirection;
			};
	  };

/** Initial form state, optionally pre-filled for an edit. */
export function initEntryForm(initial?: {
	amount?: string;
	note?: string;
	kind?: EntryKind;
	direction?: AdjustmentDirection;
}): EntryFormState {
	const note = initial?.note ?? "";
	return {
		amount: initial?.amount ?? "",
		note,
		// Show the note field expanded straight away when editing an entry that
		// already has a note, so it's visible without an extra tap.
		noteExpanded: note.length > 0,
		kind: initial?.kind ?? "spend",
		// Top-up is the friendlier default when first entering Adjust mode.
		direction: initial?.direction ?? "topup",
	};
}

export function entryFormReducer(
	state: EntryFormState,
	action: EntryFormAction,
): EntryFormState {
	switch (action.type) {
		case "key":
			return { ...state, amount: applyKey(state.amount, action.key) };
		case "note":
			return { ...state, note: action.value };
		case "expandNote":
			return { ...state, noteExpanded: true };
		case "kind":
			return { ...state, kind: action.kind };
		case "direction":
			return { ...state, direction: action.direction };
		case "reset":
			return initEntryForm(action.initial);
	}
}

/** The big, sign-aware amount preview at the top of the sheet. */
function previewText(state: EntryFormState): string {
	const magnitude = Money.fromDecimalString(state.amount).format();
	if (state.kind !== "adjustment") return magnitude;
	return `${state.direction === "topup" ? "+" : "−"}${magnitude}`;
}

export function EntryForm({
	state,
	dispatch,
	amountCents,
	onSubmit,
	submitLabel,
	submittingLabel,
	pending,
	onDelete,
	deletePending,
	showKindToggle,
}: {
	state: EntryFormState;
	dispatch: Dispatch<EntryFormAction>;
	/** The unsigned magnitude in cents (the keypad value). */
	amountCents: number;
	onSubmit: () => void;
	submitLabel: string;
	submittingLabel: string;
	pending: boolean;
	onDelete?: () => void;
	deletePending?: boolean;
	/** Show the Spend / Adjust switch (add mode only; kind is fixed on edit). */
	showKindToggle?: boolean;
}) {
	const canSubmit = amountCents > 0 && !pending;
	const isAdjustment = state.kind === "adjustment";

	return (
		<div className="flex flex-col gap-6">
			{showKindToggle ? (
				<ToggleGroup
					type="single"
					variant="outline"
					value={state.kind}
					onValueChange={(value) => {
						if (value) dispatch({ type: "kind", kind: value as EntryKind });
					}}
					className="w-full"
				>
					<ToggleGroupItem value="spend" className="flex-1">
						Spend
					</ToggleGroupItem>
					<ToggleGroupItem value="adjustment" className="flex-1">
						Adjust
					</ToggleGroupItem>
				</ToggleGroup>
			) : null}

			<p className="text-center font-semibold text-5xl tabular-nums tracking-tight">
				{previewText(state)}
			</p>

			{isAdjustment ? (
				<ToggleGroup
					type="single"
					variant="outline"
					value={state.direction}
					onValueChange={(value) => {
						if (value)
							dispatch({
								type: "direction",
								direction: value as AdjustmentDirection,
							});
					}}
					className="w-full"
				>
					<ToggleGroupItem value="topup" className="flex-1">
						+ Top-up
					</ToggleGroupItem>
					<ToggleGroupItem value="setaside" className="flex-1">
						− Set aside
					</ToggleGroupItem>
				</ToggleGroup>
			) : null}

			{state.noteExpanded ? (
				<Input
					autoFocus
					value={state.note}
					onChange={(e) => dispatch({ type: "note", value: e.target.value })}
					placeholder="Note (optional)"
					maxLength={280}
				/>
			) : (
				<Button
					type="button"
					variant="ghost"
					className="text-muted-foreground"
					onClick={() => dispatch({ type: "expandNote" })}
				>
					{state.note.trim().length > 0 ? state.note : "Add a note"}
				</Button>
			)}

			<NumericKeypad onKey={(key) => dispatch({ type: "key", key })} />

			<Button
				type="button"
				size="lg"
				className="h-14 w-full text-base"
				disabled={!canSubmit}
				onClick={onSubmit}
			>
				{pending ? submittingLabel : submitLabel}
			</Button>

			{onDelete ? (
				<DeleteAction onDelete={onDelete} disabled={deletePending} />
			) : null}
		</div>
	);
}

/** The destructive secondary action shown inside the edit sheet. */
function DeleteAction({
	onDelete,
	disabled,
}: {
	onDelete: () => void;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<Button
				type="button"
				variant="ghost"
				className="text-destructive hover:text-destructive"
				onClick={() => setOpen(true)}
			>
				Delete
			</Button>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete this entry?</AlertDialogTitle>
					<AlertDialogDescription>
						This can't be undone and your daily and monthly numbers will update.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={disabled}
						onClick={() => {
							onDelete();
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
