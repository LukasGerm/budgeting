/**
 * RoutineCard — one saved plan on the workouts hub.
 *
 * Shows the routine name, an exercise-names preview line (position order),
 * and the exercise / target-set counts. The overflow menu offers Edit
 * (navigates to the edit route) and Delete (AlertDialog confirm →
 * `routine.delete`), mirroring HabitCard's menu → controlled-dialog pattern.
 *
 * Start (slice 3): with no active workout, `workout.start({ routineId })` →
 * navigate to /workouts/active. With one running, a StartConflictDialog
 * offers Resume or Discard-and-start-new (PRD locked decision 5).
 */

import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { Ellipsis, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Card, CardContent } from "#/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { StartConflictDialog } from "#/components/workouts/start-conflict-dialog";
import { type RoutineSummary, useDeleteRoutine } from "#/hooks/use-routines";
import { useDiscardWorkout, useStartWorkout } from "#/hooks/use-workout";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";

interface RoutineCardProps {
	routine: RoutineSummary;
	/** The caller's running workout, if any — gates the Start button. */
	activeWorkoutId: string | null;
}

export function RoutineCard({ routine, activeWorkoutId }: RoutineCardProps) {
	const navigate = useNavigate();
	const deleteRoutine = useDeleteRoutine();
	const startWorkout = useStartWorkout();
	const discardWorkout = useDiscardWorkout();
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();

	// Which confirm dialog is open — menu-sibling controlled dialogs (the
	// reliable Radix pattern for menu → dialog flows, see HabitCard).
	const [dialog, setDialog] = useState<"delete" | "start-conflict" | null>(
		null,
	);

	function startFromRoutine() {
		if (startWorkout.isPending) return;
		startWorkout.mutate(
			{ routineId: routine.id },
			{
				onSuccess: () => navigate({ to: "/workouts/active" }),
				onError: (e) => {
					setDialog(null);
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	function handleStartClick() {
		if (activeWorkoutId) {
			setDialog("start-conflict");
			return;
		}
		startFromRoutine();
	}

	function handleDiscardAndStart() {
		if (!activeWorkoutId || discardWorkout.isPending) return;
		discardWorkout.mutate(
			{ id: activeWorkoutId },
			{
				onSuccess: startFromRoutine,
				onError: (e) => {
					setDialog(null);
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	function handleConfirmDelete() {
		if (deleteRoutine.isPending) return;
		deleteRoutine.mutate(
			{ id: routine.id },
			{
				onSuccess: () => {
					setDialog(null);
					toast(t`Plan deleted`);
				},
				onError: (e) => {
					setDialog(null);
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	return (
		<>
			<Card>
				<CardContent className="flex flex-col gap-3 p-4">
					<div className="flex items-start gap-1">
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<span className="truncate font-medium text-sm">
								{routine.name}
							</span>
							{/* Exercise names in position order — verbatim, not translated. */}
							<span className="truncate text-muted-foreground text-xs">
								{routine.exerciseNames.join(" · ")}
							</span>
							<span className="text-muted-foreground text-xs">
								<Plural
									value={routine.exerciseCount}
									one="# exercise"
									other="# exercises"
								/>{" "}
								·{" "}
								<Plural
									value={routine.totalTargetSets}
									one="# set"
									other="# sets"
								/>
							</span>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-11 shrink-0 text-muted-foreground"
									aria-label={t`Plan options`}
								>
									<Ellipsis className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={() =>
										navigate({
											to: "/workouts/routines/$routineId/edit",
											params: { routineId: routine.id },
										})
									}
								>
									<Trans>Edit</Trans>
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => setDialog("delete")}
									className="text-destructive focus:text-destructive"
								>
									<Trans>Delete</Trans>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<Button
						variant="secondary"
						className="h-11 w-full"
						disabled={startWorkout.isPending || discardWorkout.isPending}
						onClick={handleStartClick}
					>
						<Play aria-hidden="true" />
						<Trans>Start</Trans>
					</Button>
				</CardContent>
			</Card>

			{/* Already-active guard for Start (PRD locked decision 5). */}
			<StartConflictDialog
				open={dialog === "start-conflict"}
				onOpenChange={(open) => setDialog(open ? "start-conflict" : null)}
				onResume={() => navigate({ to: "/workouts/active" })}
				onDiscardAndStart={handleDiscardAndStart}
			/>

			{/* Delete confirm dialog */}
			<AlertDialog
				open={dialog === "delete"}
				onOpenChange={(open) => setDialog(open ? "delete" : null)}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>
							<Trans>Delete this plan?</Trans>
						</AlertDialogTitle>
						<AlertDialogDescription>
							<Trans>
								Workouts you already logged with this plan are kept. This can't
								be undone.
							</Trans>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Trans>Cancel</Trans>
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleConfirmDelete}
						>
							<Trans>Delete</Trans>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
