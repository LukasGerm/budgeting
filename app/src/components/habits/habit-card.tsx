/**
 * HabitCard — a card for a single habit.
 *
 * Slice 3: header only — icon (rendered in the habit's color) + name.
 *
 * Slice 4: adds the HabitStreakBadge in the header (right-aligned) and the
 * HabitHeatmap contribution grid in the CardContent slot. The card now takes
 * `now` (loader-provided) so heatmap today-detection agrees with the server
 * render.
 *
 * Slice 5: wires `useToggleCompletion` to `onToggleDay` so tapping any
 * non-future heatmap cell optimistically marks/unmarks that day.
 *
 * Slice 7: adds a Ellipsis icon-button in the card header that opens a
 * DropdownMenu with "Edit" and "Delete" items. Edit opens a controlled
 * HabitSheet (pre-filled); Delete opens an AlertDialog for confirmation.
 * Both the sheet and dialog are controlled via card state (`editing`,
 * `confirmingDelete`) rather than nesting triggers inside menu items — this
 * is the reliable Radix pattern for menu → dialog/drawer flows.
 */

import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { HabitHeatmap } from "#/components/habits/habit-heatmap";
import { resolveHabitIcon } from "#/components/habits/habit-icons";
import { HabitSheet } from "#/components/habits/habit-sheet";
import { HabitStreakBadge } from "#/components/habits/habit-streak-badge";
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
import { Card, CardContent, CardHeader } from "#/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	type HabitWithStats,
	useDeleteHabit,
	useToggleCompletion,
} from "#/hooks/use-habits";

interface HabitCardProps {
	habit: HabitWithStats;
	/** Loader-provided "today" (startOfDay) — passed to HabitHeatmap for today-detection. */
	now: Date;
}

export function HabitCard({ habit, now }: HabitCardProps) {
	const Icon = resolveHabitIcon(habit.icon);
	const toggle = useToggleCompletion();
	const deleteHabit = useDeleteHabit();

	// Controlled state for the edit sheet and delete confirm dialog.
	// Using card state rather than nesting triggers inside DropdownMenuItems
	// avoids Radix focus-trap / portal conflicts.
	const [editing, setEditing] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	function handleConfirmDelete() {
		if (deleteHabit.isPending) return;
		deleteHabit.mutate(
			{ id: habit.id },
			{
				onSuccess: () => {
					setConfirmingDelete(false);
					toast("Habit deleted");
				},
				onError: () => {
					setConfirmingDelete(false);
					toast.error("Couldn't delete that. Check your connection.");
				},
			},
		);
	}

	return (
		<>
			<Card>
				<CardHeader className="flex flex-row items-center gap-3 p-4 pb-3">
					{/* Left: icon + name */}
					<Icon
						className="size-5 shrink-0"
						style={{ color: habit.color }}
						aria-hidden="true"
					/>
					<span className="min-w-0 flex-1 truncate font-medium text-sm leading-none">
						{habit.name}
					</span>
					{/* Right: flame streak badge + more menu */}
					<HabitStreakBadge streak={habit.streak} />
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-7 shrink-0 text-muted-foreground"
								aria-label="Habit options"
							>
								<Ellipsis className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => setEditing(true)}>
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => setConfirmingDelete(true)}
								className="text-destructive focus:text-destructive"
							>
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardHeader>
				<CardContent className="px-4 pb-4">
					<HabitHeatmap
						weeks={habit.heatmap.weeks}
						color={habit.color}
						now={now}
						onToggleDay={(isoDay, currentlyDone) =>
							toggle.mutate({
								habitId: habit.id,
								day: isoDay,
								done: !currentlyDone,
							})
						}
					/>
				</CardContent>
			</Card>

			{/* Edit sheet — controlled by `editing` state, rendered as a sibling to
			    avoid nesting a Drawer trigger inside the DropdownMenuItem. */}
			<HabitSheet
				key={editing ? `edit-${habit.id}` : "edit-closed"}
				habit={habit}
				open={editing}
				onOpenChange={setEditing}
			/>

			{/* Delete confirm dialog — controlled by `confirmingDelete` state. */}
			<AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this habit?</AlertDialogTitle>
						<AlertDialogDescription>
							All completion history for this habit will be permanently removed.
							This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleConfirmDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
