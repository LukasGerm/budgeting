/**
 * HabitSheet — create or edit a habit in a vaul bottom sheet.
 *
 * Mirrors SpendSheet: owns `open` state by default, resets on close, uses a
 * shadcn Drawer.
 *
 * **Controlled-open mode (slice 7):** Pass `open` + `onOpenChange` to let a
 * parent (e.g. HabitCard) control visibility programmatically. In this mode the
 * internal `trigger` is not rendered. When neither prop is provided the sheet
 * manages its own state (uncontrolled), keeping the FAB "Add habit" create usage
 * on the Habits page unchanged.
 *
 * **Edit mode:** Pass a `habit` prop to pre-fill the name + icon and switch the
 * title/submit label to "Edit habit" / "Save changes". The submit handler calls
 * `useUpdateHabit` instead of `useCreateHabit`. `color` is NOT editable — it is
 * immutable post-create.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	HABIT_ICON_COMPONENTS,
	HABIT_ICON_NAMES,
	type HabitIconName,
} from "#/components/habits/habit-icons";
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
import { Label } from "#/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import type { Habit } from "#/hooks/use-habits";
import { useCreateHabit, useUpdateHabit } from "#/hooks/use-habits";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";

interface HabitSheetProps {
	/**
	 * Optional trigger element. Used as the `DrawerTrigger` child in uncontrolled
	 * mode. When omitted in uncontrolled mode the sheet renders its own FAB-style
	 * "Add habit" button, matching the SpendSheet pattern. Ignored in controlled
	 * mode (`open` + `onOpenChange` provided).
	 */
	trigger?: React.ReactNode;
	/**
	 * Pre-fill the form with this habit's values for edit mode.
	 * When supplied the sheet title becomes "Edit habit" and the submit button
	 * reads "Save changes". The update mutation is called on submit.
	 * `color` is not editable — only name + icon.
	 */
	habit?: Habit;
	/**
	 * Controlled open state. When provided together with `onOpenChange` the sheet
	 * is controlled by the parent; the internal trigger is not rendered.
	 */
	open?: boolean;
	/**
	 * Controlled open-change callback. Required when `open` is provided.
	 */
	onOpenChange?: (open: boolean) => void;
}

export function HabitSheet({
	trigger,
	habit: existingHabit,
	open: controlledOpen,
	onOpenChange: onControlledOpenChange,
}: HabitSheetProps) {
	const [internalOpen, setInternalOpen] = useState(false);

	// Controlled vs. uncontrolled: if the parent passes `open`+`onOpenChange`,
	// delegate to them; otherwise own the state internally.
	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;

	const [name, setName] = useState(existingHabit?.name ?? "");
	const [icon, setIcon] = useState<HabitIconName | "">(
		(existingHabit?.icon as HabitIconName | undefined) ?? "",
	);

	const createHabit = useCreateHabit();
	const updateHabit = useUpdateHabit();
	const isEdit = existingHabit != null;
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();

	function handleOpenChange(next: boolean) {
		if (isControlled) {
			onControlledOpenChange?.(next);
		} else {
			setInternalOpen(next);
		}
		if (!next) {
			// Reset to empty (create) or original values (edit) on close.
			setName(existingHabit?.name ?? "");
			setIcon((existingHabit?.icon as HabitIconName | undefined) ?? "");
		}
	}

	const trimmedName = name.trim();
	const canSubmit = trimmedName.length > 0 && icon.length > 0;
	const isPending = isEdit ? updateHabit.isPending : createHabit.isPending;

	function handleSubmit() {
		if (!canSubmit || isPending) return;

		if (isEdit) {
			updateHabit.mutate(
				{
					id: existingHabit.id,
					name: trimmedName,
					icon: icon as HabitIconName,
				},
				{
					onSuccess: () => {
						handleOpenChange(false);
						toast(t`Habit updated`);
					},
					onError: (e) => {
						toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
					},
				},
			);
			return;
		}

		createHabit.mutate(
			// icon is guaranteed non-empty by canSubmit guard above.
			{ name: trimmedName, icon: icon as HabitIconName },
			{
				onSuccess: () => {
					handleOpenChange(false);
					toast(t`Habit created`);
				},
				onError: (e) => {
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	const title = isEdit ? t`Edit habit` : t`New habit`;
	const submitLabel = isEdit ? t`Save changes` : t`Create habit`;
	const submittingLabel = isEdit ? t`Saving…` : t`Creating…`;

	const content = (
		<DrawerContent>
			<div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 pb-8">
				<DrawerHeader className="p-0">
					<DrawerTitle>{title}</DrawerTitle>
					<DrawerDescription className="sr-only">
						<Trans>Enter a name and pick an icon for your habit.</Trans>
					</DrawerDescription>
				</DrawerHeader>

				{/* Name input */}
				<div className="flex flex-col gap-2">
					<Label htmlFor="habit-name">
						<Trans>Name</Trans>
					</Label>
					<Input
						id="habit-name"
						placeholder={t`e.g. Read for 20 minutes`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={60}
						autoFocus
					/>
				</div>

				{/* Icon grid */}
				<div className="flex flex-col gap-2">
					<Label>
						<Trans>Icon</Trans>
					</Label>
					<ToggleGroup
						type="single"
						value={icon}
						onValueChange={(v) => {
							if (v) setIcon(v as HabitIconName);
						}}
						className="flex flex-wrap gap-2"
					>
						{HABIT_ICON_NAMES.map((iconName) => {
							const Icon = HABIT_ICON_COMPONENTS[iconName];
							return (
								<ToggleGroupItem
									key={iconName}
									value={iconName}
									aria-label={iconName}
									className="size-10 rounded-md"
								>
									<Icon className="size-4" />
								</ToggleGroupItem>
							);
						})}
					</ToggleGroup>
				</div>

				{/* Submit */}
				<Button
					onClick={handleSubmit}
					disabled={!canSubmit || isPending}
					className="w-full"
				>
					{isPending ? submittingLabel : submitLabel}
				</Button>
			</div>
		</DrawerContent>
	);

	// Controlled mode: no trigger rendered — parent drives visibility entirely.
	if (isControlled) {
		return (
			<Drawer open={open} onOpenChange={handleOpenChange}>
				{content}
			</Drawer>
		);
	}

	// Uncontrolled mode: render with a trigger (FAB or custom).
	return (
		<Drawer open={open} onOpenChange={handleOpenChange}>
			<DrawerTrigger asChild>
				{trigger ?? (
					<Button
						size="icon"
						className="fixed right-6 bottom-20 z-40 size-16 rounded-full shadow-lg"
						aria-label={t`Add a habit`}
					>
						<Plus className="size-7" />
					</Button>
				)}
			</DrawerTrigger>
			{content}
		</Drawer>
	);
}
