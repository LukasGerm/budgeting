/**
 * ExercisePicker — bottom-sheet drawer for adding exercises to a routine.
 *
 * Controlled drawer (parent owns `open`), mirroring the HabitSheet pattern.
 * Browse view: search input + muscle-group filter chips + tappable exercise
 * list. Rows already in the routine show a check and are disabled, and the
 * drawer stays open after a tap so several exercises can be added in one go
 * ("Done" closes it).
 *
 * Create view: an inline "create custom exercise" form (name, muscle group,
 * equipment) that calls `exercise.create` and auto-adds the new exercise to
 * the routine being built, then returns to the browse view.
 *
 * Exercise names are NOT translated (PRD) — rendered verbatim. Muscle-group /
 * equipment labels come from `useWorkoutLabels()`.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { Check, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "#/components/ui/drawer";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import {
	EQUIPMENT_KINDS,
	type EquipmentKind,
	MUSCLE_GROUPS,
	type MuscleGroup,
	useWorkoutLabels,
} from "#/components/workouts/workout-labels";
import {
	type Exercise,
	useCreateExercise,
	useExercises,
} from "#/hooks/use-exercises";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";

interface ExercisePickerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Called with the chosen (or freshly created) exercise. */
	onPick: (exercise: Exercise) => void;
	/** Exercise ids already in the routine — shown checked and disabled. */
	addedExerciseIds: string[];
}

/** One state object for the whole picker — keeps the useState count lean. */
interface PickerState {
	view: "browse" | "create";
	search: string;
	filter: MuscleGroup | "ALL";
	customName: string;
	customMuscleGroup: MuscleGroup | "";
	customEquipment: EquipmentKind | "";
}

const INITIAL_STATE: PickerState = {
	view: "browse",
	search: "",
	filter: "ALL",
	customName: "",
	customMuscleGroup: "",
	customEquipment: "",
};

export function ExercisePicker({
	open,
	onOpenChange,
	onPick,
	addedExerciseIds,
}: ExercisePickerProps) {
	const [state, setState] = useState<PickerState>(INITIAL_STATE);
	const exercises = useExercises();
	const createExercise = useCreateExercise();
	const labels = useWorkoutLabels();
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();

	function patch(partial: Partial<PickerState>) {
		setState((prev) => ({ ...prev, ...partial }));
	}

	function handleOpenChange(next: boolean) {
		onOpenChange(next);
		if (!next) setState(INITIAL_STATE);
	}

	const query = state.search.trim().toLowerCase();
	const visible = exercises.filter(
		(exercise) =>
			(state.filter === "ALL" || exercise.muscleGroup === state.filter) &&
			(query.length === 0 || exercise.name.toLowerCase().includes(query)),
	);

	const customName = state.customName.trim();
	const canCreate =
		customName.length > 0 &&
		state.customMuscleGroup !== "" &&
		state.customEquipment !== "" &&
		!createExercise.isPending;

	function handleCreate() {
		if (!canCreate) return;
		createExercise.mutate(
			{
				name: customName,
				// Both guaranteed non-empty by the canCreate guard above.
				muscleGroup: state.customMuscleGroup as MuscleGroup,
				equipment: state.customEquipment as EquipmentKind,
			},
			{
				onSuccess: (created) => {
					onPick(created);
					toast(t`Exercise created and added`);
					// Back to browsing with a clean slate so more can be added.
					patch({
						view: "browse",
						search: "",
						customName: "",
						customMuscleGroup: "",
						customEquipment: "",
					});
				},
				onError: (e) => {
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	return (
		<Drawer open={open} onOpenChange={handleOpenChange}>
			<DrawerContent className="max-h-[85vh]">
				<div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col gap-4 p-4 pb-8">
					<DrawerHeader className="p-0">
						<DrawerTitle>
							{state.view === "create" ? (
								<Trans>New custom exercise</Trans>
							) : (
								<Trans>Add exercise</Trans>
							)}
						</DrawerTitle>
						<DrawerDescription className="sr-only">
							<Trans>
								Search the exercise library or create a custom exercise.
							</Trans>
						</DrawerDescription>
					</DrawerHeader>

					{state.view === "browse" ? (
						<>
							{/* Search */}
							<div className="relative">
								<Search
									className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
									aria-hidden="true"
								/>
								<Input
									value={state.search}
									onChange={(e) => patch({ search: e.target.value })}
									placeholder={t`Search exercises`}
									className="h-11 pl-9"
									aria-label={t`Search exercises`}
								/>
							</div>

							{/* Muscle-group filter chips — horizontally scrollable row.
							    `shrink-0` is load-bearing: with overflow-x-auto the row's
							    implicit min-height is 0, so without it the drawer's column
							    flex squashes the row on first open (before vaul re-measures)
							    and the chips render vertically clipped. */}
							<div className="-mx-4 shrink-0 overflow-x-auto px-4">
								<ToggleGroup
									type="single"
									value={state.filter}
									onValueChange={(value) => {
										if (value)
											patch({ filter: value as PickerState["filter"] });
									}}
									className="flex w-max gap-2"
								>
									<ToggleGroupItem
										value="ALL"
										className="h-11 rounded-full border px-4"
									>
										<Trans>All</Trans>
									</ToggleGroupItem>
									{MUSCLE_GROUPS.map((group) => (
										<ToggleGroupItem
											key={group}
											value={group}
											className="h-11 rounded-full border px-4"
										>
											{labels.muscleGroup[group]}
										</ToggleGroupItem>
									))}
								</ToggleGroup>
							</div>

							{/* Exercise list */}
							<div className="min-h-0 flex-1 overflow-y-auto">
								{visible.length === 0 ? (
									<p className="py-8 text-center text-muted-foreground text-sm">
										<Trans>No exercises match your search.</Trans>
									</p>
								) : (
									<ul className="flex flex-col">
										{visible.map((exercise) => {
											const added = addedExerciseIds.includes(exercise.id);
											return (
												<li key={exercise.id}>
													<button
														type="button"
														disabled={added}
														onClick={() => onPick(exercise)}
														className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent disabled:opacity-50"
													>
														<span className="flex min-w-0 flex-1 flex-col">
															<span className="truncate font-medium text-sm">
																{exercise.name}
															</span>
															<span className="truncate text-muted-foreground text-xs">
																{labels.muscleGroup[exercise.muscleGroup]} ·{" "}
																{labels.equipment[exercise.equipment]}
															</span>
														</span>
														{added && (
															<Check
																className="size-4 shrink-0 text-muted-foreground"
																aria-hidden="true"
															/>
														)}
													</button>
												</li>
											);
										})}
									</ul>
								)}
							</div>

							{/* Footer: inline create affordance + done */}
							<div className="flex flex-col gap-2">
								<Button
									variant="outline"
									className="h-11 w-full"
									onClick={() =>
										patch({
											view: "create",
											// Prefill from the current search / filter — likely what
											// the user was looking for and didn't find.
											customName: state.search.trim(),
											customMuscleGroup:
												state.filter === "ALL" ? "" : state.filter,
										})
									}
								>
									<Plus aria-hidden="true" />
									<Trans>Create custom exercise</Trans>
								</Button>
								<Button
									className="h-11 w-full"
									onClick={() => handleOpenChange(false)}
								>
									<Trans>Done</Trans>
								</Button>
							</div>
						</>
					) : (
						<>
							{/* Inline create form */}
							<div className="flex flex-col gap-2">
								<Label htmlFor="custom-exercise-name">
									<Trans>Name</Trans>
								</Label>
								<Input
									id="custom-exercise-name"
									value={state.customName}
									onChange={(e) => patch({ customName: e.target.value })}
									placeholder={t`e.g. Hip Thrust`}
									maxLength={80}
									className="h-11"
									autoFocus
								/>
							</div>

							<div className="flex flex-col gap-2">
								<Label htmlFor="custom-exercise-muscle">
									<Trans>Muscle group</Trans>
								</Label>
								<Select
									value={state.customMuscleGroup}
									onValueChange={(value) =>
										patch({ customMuscleGroup: value as MuscleGroup })
									}
								>
									<SelectTrigger
										id="custom-exercise-muscle"
										className="h-11 w-full"
									>
										<SelectValue placeholder={t`Pick a muscle group`} />
									</SelectTrigger>
									<SelectContent>
										{MUSCLE_GROUPS.map((group) => (
											<SelectItem key={group} value={group}>
												{labels.muscleGroup[group]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="flex flex-col gap-2">
								<Label htmlFor="custom-exercise-equipment">
									<Trans>Equipment</Trans>
								</Label>
								<Select
									value={state.customEquipment}
									onValueChange={(value) =>
										patch({ customEquipment: value as EquipmentKind })
									}
								>
									<SelectTrigger
										id="custom-exercise-equipment"
										className="h-11 w-full"
									>
										<SelectValue placeholder={t`Pick equipment`} />
									</SelectTrigger>
									<SelectContent>
										{EQUIPMENT_KINDS.map((kind) => (
											<SelectItem key={kind} value={kind}>
												{labels.equipment[kind]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="flex flex-col gap-2 pt-2">
								<Button
									className="h-11 w-full"
									disabled={!canCreate}
									onClick={handleCreate}
								>
									{createExercise.isPending ? (
										<Trans>Creating…</Trans>
									) : (
										<Trans>Create and add</Trans>
									)}
								</Button>
								<Button
									variant="ghost"
									className="h-11 w-full"
									onClick={() => patch({ view: "browse" })}
								>
									<Trans>Back to library</Trans>
								</Button>
							</div>
						</>
					)}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
