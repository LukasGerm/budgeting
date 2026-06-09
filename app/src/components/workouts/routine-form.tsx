/**
 * RoutineForm — the routine builder shared by the "new" and "edit" routes.
 *
 * The whole draft lives in ONE state object (`RoutineDraft`) — name,
 * description, and the ordered exercise list — per the project's
 * keep-local-state-lean rule. The only other state is the picker drawer's
 * open flag. Reordering delegates to the pure `moveItem` domain helper.
 *
 * Submission is the parent's job: the form validates (name required, ≥ 1
 * exercise, every rep target non-empty), converts the draft to the
 * `routine.create`/`routine.update` wire payload, and calls `onSubmit`.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { ChevronDown, ChevronUp, Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { ExercisePicker } from "#/components/workouts/exercise-picker";
import {
	type EquipmentKind,
	type MuscleGroup,
	useWorkoutLabels,
} from "#/components/workouts/workout-labels";
import { moveItem } from "#/domain";
import type { Exercise } from "#/hooks/use-exercises";
import type { RoutineInput } from "#/hooks/use-routines";

/** One exercise row in the draft — wire fields + library data for display. */
export interface RoutineDraftExercise {
	exerciseId: string;
	name: string;
	muscleGroup: MuscleGroup;
	equipment: EquipmentKind;
	targetSets: number;
	targetReps: string;
	restSeconds: number;
}

/** The full builder draft — one object so the form stays at two useStates. */
export interface RoutineDraft {
	name: string;
	description: string;
	exercises: RoutineDraftExercise[];
}

/** PRD limits, enforced in the UI and re-checked by zod on the server. */
const MAX_EXERCISES = 20;
const MIN_SETS = 1;
const MAX_SETS = 12;

/** Rest-time choices: 0s / 30s / 60s / 90s / 2min / 3min / 5min. */
const REST_OPTIONS = [0, 30, 60, 90, 120, 180, 300] as const;

/** Defaults applied when an exercise is added from the picker. */
const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS = "8-12";
const DEFAULT_REST_SECONDS = 120;

interface RoutineFormProps {
	/** Pre-filled draft (edit mode); omit for a blank new-routine form. */
	initial?: RoutineDraft;
	submitLabel: string;
	submittingLabel: string;
	isPending: boolean;
	onSubmit: (input: RoutineInput) => void;
}

const EMPTY_DRAFT: RoutineDraft = { name: "", description: "", exercises: [] };

export function RoutineForm({
	initial,
	submitLabel,
	submittingLabel,
	isPending,
	onSubmit,
}: RoutineFormProps) {
	const [draft, setDraft] = useState<RoutineDraft>(initial ?? EMPTY_DRAFT);
	const [pickerOpen, setPickerOpen] = useState(false);
	const labels = useWorkoutLabels();
	const { t } = useLingui();

	function patchExercise(
		index: number,
		partial: Partial<RoutineDraftExercise>,
	) {
		setDraft((prev) => ({
			...prev,
			exercises: prev.exercises.map((exercise, i) =>
				i === index ? { ...exercise, ...partial } : exercise,
			),
		}));
	}

	function addExercise(exercise: Exercise) {
		setDraft((prev) => {
			if (prev.exercises.length >= MAX_EXERCISES) return prev;
			return {
				...prev,
				exercises: [
					...prev.exercises,
					{
						exerciseId: exercise.id,
						name: exercise.name,
						muscleGroup: exercise.muscleGroup,
						equipment: exercise.equipment,
						targetSets: DEFAULT_TARGET_SETS,
						targetReps: DEFAULT_TARGET_REPS,
						restSeconds: DEFAULT_REST_SECONDS,
					},
				],
			};
		});
	}

	function restLabel(seconds: number): string {
		if (seconds === 0) return t`No rest`;
		if (seconds < 120) return t`${seconds} s`;
		const minutes = seconds / 60;
		return t`${minutes} min`;
	}

	const trimmedName = draft.name.trim();
	const canSubmit =
		trimmedName.length > 0 &&
		draft.exercises.length > 0 &&
		draft.exercises.every((e) => e.targetReps.trim().length > 0) &&
		!isPending;

	function handleSubmit() {
		if (!canSubmit) return;
		const description = draft.description.trim();
		onSubmit({
			name: trimmedName,
			description: description.length > 0 ? description : undefined,
			exercises: draft.exercises.map((e) => ({
				exerciseId: e.exerciseId,
				targetSets: e.targetSets,
				targetReps: e.targetReps.trim(),
				restSeconds: e.restSeconds,
			})),
		});
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Name + description */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="routine-name">
					<Trans>Name</Trans>
				</Label>
				<Input
					id="routine-name"
					value={draft.name}
					onChange={(e) =>
						setDraft((prev) => ({ ...prev, name: e.target.value }))
					}
					placeholder={t`e.g. Push Day A`}
					maxLength={80}
					className="h-11"
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="routine-description">
					<Trans>Description (optional)</Trans>
				</Label>
				<Input
					id="routine-description"
					value={draft.description}
					onChange={(e) =>
						setDraft((prev) => ({ ...prev, description: e.target.value }))
					}
					placeholder={t`e.g. Chest, shoulders, triceps`}
					maxLength={280}
					className="h-11"
				/>
			</div>

			{/* Ordered exercise list */}
			<section
				className="flex flex-col gap-3"
				aria-labelledby="exercises-heading"
			>
				<h2 id="exercises-heading" className="font-medium text-sm">
					<Trans>Exercises</Trans>
				</h2>

				{draft.exercises.length === 0 && (
					<p className="text-muted-foreground text-sm">
						<Trans>Add at least one exercise to your plan.</Trans>
					</p>
				)}

				{/* exerciseId is unique within a draft — the picker disables rows
				    that are already added, so it's a stable, order-independent key. */}
				{draft.exercises.map((exercise, index) => (
					<Card key={exercise.exerciseId}>
						<CardContent className="flex flex-col gap-3 p-4">
							{/* Header: name + reorder/remove controls */}
							<div className="flex items-center gap-1">
								<div className="flex min-w-0 flex-1 flex-col">
									<span className="truncate font-medium text-sm">
										{exercise.name}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{labels.muscleGroup[exercise.muscleGroup]}
									</span>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="size-11 text-muted-foreground"
									disabled={index === 0}
									onClick={() =>
										setDraft((prev) => ({
											...prev,
											exercises: moveItem(prev.exercises, index, -1),
										}))
									}
									aria-label={t`Move up`}
								>
									<ChevronUp className="size-5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-11 text-muted-foreground"
									disabled={index === draft.exercises.length - 1}
									onClick={() =>
										setDraft((prev) => ({
											...prev,
											exercises: moveItem(prev.exercises, index, 1),
										}))
									}
									aria-label={t`Move down`}
								>
									<ChevronDown className="size-5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-11 text-muted-foreground"
									onClick={() =>
										setDraft((prev) => ({
											...prev,
											exercises: prev.exercises.filter((_, i) => i !== index),
										}))
									}
									aria-label={t`Remove exercise`}
								>
									<X className="size-5" />
								</Button>
							</div>

							{/* Target sets stepper */}
							<div className="flex items-center justify-between gap-3">
								<Label className="text-muted-foreground text-xs">
									<Trans>Sets</Trans>
								</Label>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="icon"
										className="size-11"
										disabled={exercise.targetSets <= MIN_SETS}
										onClick={() =>
											patchExercise(index, {
												targetSets: Math.max(MIN_SETS, exercise.targetSets - 1),
											})
										}
										aria-label={t`One set fewer`}
									>
										<Minus className="size-4" />
									</Button>
									<span className="w-8 text-center font-medium text-sm tabular-nums">
										{exercise.targetSets}
									</span>
									<Button
										variant="outline"
										size="icon"
										className="size-11"
										disabled={exercise.targetSets >= MAX_SETS}
										onClick={() =>
											patchExercise(index, {
												targetSets: Math.min(MAX_SETS, exercise.targetSets + 1),
											})
										}
										aria-label={t`One set more`}
									>
										<Plus className="size-4" />
									</Button>
								</div>
							</div>

							{/* Reps + rest */}
							<div className="grid grid-cols-2 gap-3">
								<div className="flex flex-col gap-1.5">
									<Label
										htmlFor={`reps-${index}`}
										className="text-muted-foreground text-xs"
									>
										<Trans>Reps</Trans>
									</Label>
									<Input
										id={`reps-${index}`}
										value={exercise.targetReps}
										onChange={(e) =>
											patchExercise(index, { targetReps: e.target.value })
										}
										placeholder={t`e.g. 8-12`}
										maxLength={20}
										className="h-11"
									/>
								</div>
								<div className="flex flex-col gap-1.5">
									<Label
										htmlFor={`rest-${index}`}
										className="text-muted-foreground text-xs"
									>
										<Trans>Rest</Trans>
									</Label>
									<Select
										value={String(exercise.restSeconds)}
										onValueChange={(value) =>
											patchExercise(index, { restSeconds: Number(value) })
										}
									>
										<SelectTrigger id={`rest-${index}`} className="h-11 w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{REST_OPTIONS.map((seconds) => (
												<SelectItem key={seconds} value={String(seconds)}>
													{restLabel(seconds)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardContent>
					</Card>
				))}

				<Button
					variant="outline"
					className="h-11 w-full"
					disabled={draft.exercises.length >= MAX_EXERCISES}
					onClick={() => setPickerOpen(true)}
				>
					<Plus aria-hidden="true" />
					<Trans>Add exercise</Trans>
				</Button>
			</section>

			{/* Save */}
			<Button
				className="h-11 w-full"
				disabled={!canSubmit}
				onClick={handleSubmit}
			>
				{isPending ? submittingLabel : submitLabel}
			</Button>

			<ExercisePicker
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				onPick={addExercise}
				addedExerciseIds={draft.exercises.map((e) => e.exerciseId)}
			/>
		</div>
	);
}
