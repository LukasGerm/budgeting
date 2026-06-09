/**
 * WorkoutExerciseCard — one exercise of the live workout: header (name,
 * muscle group, rest duration, overflow menu) plus the set rows and an
 * "Add set" button.
 *
 * Set rows are mostly server state (TanStack Query via the use-workout
 * hooks). The weight/reps inputs are uncontrolled — `defaultValue` + a key
 * that embeds the server value, committing on blur via `updateSet` — so no
 * per-keystroke state lives here. Checking a set off goes through the
 * optimistic `useUpdateSet`, so the row flips instantly; when the exercise
 * has a rest duration the parent is told to start the rest timer.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { Check, Ellipsis, LineChart, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { useWorkoutLabels } from "#/components/workouts/workout-labels";
import { formatDuration, formatKg, parseKgToGrams, parseReps } from "#/domain";
import {
	type ActiveWorkoutExercise,
	type ActiveWorkoutSet,
	useAddSet,
	useDeleteSet,
	useRemoveWorkoutExercise,
	useUpdateSet,
} from "#/hooks/use-workout";
import { useErrorMessage } from "#/i18n/use-error-message";
import { cn } from "#/lib/utils";

interface WorkoutExerciseCardProps {
	exercise: ActiveWorkoutExercise;
	/** Start the rest timer — called when a set flips to completed. */
	onRestStart: (restSeconds: number) => void;
}

/** "80 kg × 8" hint from the last finished session, or an em-dash. */
function previousHint(set: ActiveWorkoutSet): string {
	if (!set.previous) return "—";
	const weight =
		set.previous.weightGrams != null
			? `${formatKg(set.previous.weightGrams)} kg`
			: "—";
	const reps = set.previous.reps != null ? `${set.previous.reps}` : "—";
	return `${weight} × ${reps}`;
}

export function WorkoutExerciseCard({
	exercise,
	onRestStart,
}: WorkoutExerciseCardProps) {
	const labels = useWorkoutLabels();
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();
	const updateSet = useUpdateSet();
	const addSet = useAddSet();
	const deleteSet = useDeleteSet();
	const removeExercise = useRemoveWorkoutExercise();

	const onMutationError = () => toast.error(getErrorMessage("SAVE_FAILED"));

	function commitWeight(set: ActiveWorkoutSet, input: HTMLInputElement): void {
		const parsed = parseKgToGrams(input.value);
		if (parsed === undefined) {
			// Unparsable / out of range — restore the last committed value.
			input.value = set.weightGrams != null ? formatKg(set.weightGrams) : "";
			return;
		}
		if (parsed === set.weightGrams) return;
		updateSet.mutate(
			{ setId: set.id, weightGrams: parsed },
			{ onError: onMutationError },
		);
	}

	function commitReps(set: ActiveWorkoutSet, input: HTMLInputElement): void {
		const parsed = parseReps(input.value);
		if (parsed === undefined) {
			input.value = set.reps != null ? String(set.reps) : "";
			return;
		}
		if (parsed === set.reps) return;
		updateSet.mutate(
			{ setId: set.id, reps: parsed },
			{ onError: onMutationError },
		);
	}

	function toggleCompleted(set: ActiveWorkoutSet): void {
		const next = !set.completed;
		updateSet.mutate(
			{ setId: set.id, completed: next },
			{ onError: onMutationError },
		);
		if (next && exercise.restSeconds > 0) {
			onRestStart(exercise.restSeconds);
		}
	}

	return (
		<Card>
			<CardContent className="flex flex-col gap-3 p-4">
				{/* Header: name, muscle group + rest, overflow menu */}
				<div className="flex items-start gap-1">
					<div className="flex min-w-0 flex-1 flex-col">
						{/* Exercise names are data, not chrome — rendered verbatim. */}
						<span className="truncate font-medium text-sm">
							{exercise.name}
						</span>
						<span className="truncate text-muted-foreground text-xs">
							{labels.muscleGroup[exercise.muscleGroup]} ·{" "}
							<Trans>Rest {formatDuration(exercise.restSeconds)}</Trans>
						</span>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="-mt-1 size-11 shrink-0 text-muted-foreground"
								aria-label={t`Exercise options`}
							>
								<Ellipsis className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem asChild>
								<Link
									to="/workouts/exercises/$exerciseId"
									params={{ exerciseId: exercise.exerciseId }}
								>
									<LineChart aria-hidden="true" />
									<Trans>View progress</Trans>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									removeExercise.mutate(
										{ workoutExerciseId: exercise.id },
										{ onError: onMutationError },
									)
								}
								className="text-destructive focus:text-destructive"
							>
								<Trans>Remove exercise</Trans>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Column headers */}
				<div className="grid grid-cols-[1.75rem_minmax(0,1fr)_4.25rem_3.5rem_2.75rem_2rem] items-center gap-1.5 text-muted-foreground text-xs">
					<span>
						<Trans>Set</Trans>
					</span>
					<span>
						<Trans>Previous</Trans>
					</span>
					<span className="text-center">
						<Trans>kg</Trans>
					</span>
					<span className="text-center">
						<Trans>Reps</Trans>
					</span>
					<span aria-hidden="true" />
					<span aria-hidden="true" />
				</div>

				{/* Set rows */}
				<div className="flex flex-col gap-1">
					{exercise.sets.map((set) => (
						<div
							key={set.id}
							className={cn(
								"-mx-2 grid grid-cols-[1.75rem_minmax(0,1fr)_4.25rem_3.5rem_2.75rem_2rem] items-center gap-1.5 rounded-md px-2 py-1",
								set.completed && "bg-emerald-500/10",
							)}
						>
							<span className="font-medium text-muted-foreground text-sm tabular-nums">
								{set.setNumber}
							</span>
							{/* Last session's matching set — progressive-overload hint. */}
							<span className="truncate text-muted-foreground text-xs tabular-nums">
								{previousHint(set)}
							</span>
							<Input
								// Remount when the committed value changes (e.g. optimistic
								// update or refetch) — defaultValue only applies on mount.
								key={`w-${set.id}-${set.weightGrams}`}
								type="text"
								inputMode="decimal"
								defaultValue={
									set.weightGrams != null ? formatKg(set.weightGrams) : ""
								}
								onBlur={(e) => commitWeight(set, e.currentTarget)}
								onKeyDown={(e) => {
									if (e.key === "Enter") e.currentTarget.blur();
								}}
								className="h-11 px-1 text-center tabular-nums"
								aria-label={t`Weight in kilograms, set ${set.setNumber}`}
							/>
							<Input
								key={`r-${set.id}-${set.reps}`}
								type="text"
								inputMode="numeric"
								defaultValue={set.reps != null ? String(set.reps) : ""}
								onBlur={(e) => commitReps(set, e.currentTarget)}
								onKeyDown={(e) => {
									if (e.key === "Enter") e.currentTarget.blur();
								}}
								className="h-11 px-1 text-center tabular-nums"
								aria-label={t`Reps, set ${set.setNumber}`}
							/>
							<Button
								variant={set.completed ? "default" : "outline"}
								size="icon"
								className={cn(
									"size-11",
									set.completed &&
										"bg-emerald-600 text-white hover:bg-emerald-600/90",
								)}
								onClick={() => toggleCompleted(set)}
								aria-label={
									set.completed
										? t`Mark set ${set.setNumber} as not done`
										: t`Mark set ${set.setNumber} as done`
								}
								aria-pressed={set.completed}
							>
								<Check className="size-4" aria-hidden="true" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-8 justify-self-center text-muted-foreground"
								onClick={() =>
									deleteSet.mutate(
										{ setId: set.id },
										{ onError: onMutationError },
									)
								}
								aria-label={t`Delete set ${set.setNumber}`}
							>
								<Trash2 className="size-3.5" aria-hidden="true" />
							</Button>
						</div>
					))}
				</div>

				{exercise.sets.length === 0 && (
					<p className="text-muted-foreground text-sm">
						<Trans>No sets — add one below.</Trans>
					</p>
				)}

				<Button
					variant="ghost"
					className="h-11 w-full"
					onClick={() =>
						addSet.mutate(
							{ workoutExerciseId: exercise.id },
							{ onError: onMutationError },
						)
					}
				>
					<Plus aria-hidden="true" />
					<Trans>Add set</Trans>
				</Button>
			</CardContent>
		</Card>
	);
}
