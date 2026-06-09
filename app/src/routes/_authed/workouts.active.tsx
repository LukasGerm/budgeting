/**
 * Live workout screen — full-screen logging mode (PRD locked decision 1:
 * the `_authed` layout hides the bottom nav + top app-bar on this route).
 *
 * The loader prefetches `workout.active` (redirecting to /workouts when
 * nothing is running) plus `exercise.list` for the add-exercise picker.
 * All server state lives in the `workout.active` query; the only local
 * state is the rest timer (pure client state, PRD locked decision 6) and
 * which dialog/drawer is open.
 */

import { Plural, Trans, useLingui } from "@lingui/react/macro";
import {
	createFileRoute,
	Link,
	Navigate,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
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
import { ElapsedTicker } from "#/components/workouts/elapsed-ticker";
import { ExercisePicker } from "#/components/workouts/exercise-picker";
import { RestTimerBar } from "#/components/workouts/rest-timer-bar";
import { WorkoutExerciseCard } from "#/components/workouts/workout-exercise-card";
import { formatKg, workoutVolumeGrams } from "#/domain";
import {
	type ActiveWorkout,
	useActiveWorkout,
	useAddWorkoutExercise,
	useDiscardWorkout,
	useFinishWorkout,
} from "#/hooks/use-workout";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";
import { withLoginRedirect } from "#/lib/loader-auth";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_authed/workouts/active")({
	loader: async ({ context }) => {
		const [active] = await withLoginRedirect(() =>
			Promise.all([
				context.queryClient.ensureQueryData(
					context.trpc.workout.active.queryOptions(),
				),
				// The add-exercise picker browses the library.
				context.queryClient.ensureQueryData(
					context.trpc.exercise.list.queryOptions(),
				),
			]),
		);
		// No running workout → nothing to log; back to the hub.
		if (!active) throw redirect({ to: "/workouts" });
	},
	component: ActiveWorkoutPage,
});

/** Which overlay is open — one state instead of three booleans. */
type OpenOverlay = "picker" | "finish" | "discard" | null;

/** Rest-timer trigger: bumping `nonce` remounts the bar (restart). */
interface RestState {
	nonce: number;
	seconds: number;
}

function ActiveWorkoutPage() {
	// Set by the finish/discard handlers *before* they mutate: the mutation
	// invalidates `workout.active` (refetching it to null), which would
	// otherwise make the guard below bounce to /workouts and beat the
	// deliberate `navigate(...)` to the history detail (or hub).
	const leavingRef = useRef(false);
	const workout = useActiveWorkout();
	// The workout can become null mid-session (finished/discarded, possibly in
	// another tab) — bounce to the hub instead of crashing on `.exercises`.
	// When we're leaving deliberately the navigation is already in flight, so
	// render nothing for the frame(s) until the router swaps routes.
	if (!workout) {
		if (leavingRef.current) return null;
		return <Navigate to="/workouts" />;
	}
	return <ActiveWorkoutScreen workout={workout} leavingRef={leavingRef} />;
}

function ActiveWorkoutScreen({
	workout,
	leavingRef,
}: {
	workout: ActiveWorkout;
	leavingRef: RefObject<boolean>;
}) {
	const navigate = useNavigate();
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();
	const finishWorkout = useFinishWorkout();
	const discardWorkout = useDiscardWorkout();
	const addExercise = useAddWorkoutExercise();

	const [overlay, setOverlay] = useState<OpenOverlay>(null);
	const [rest, setRest] = useState<RestState | null>(null);

	const allSets = workout.exercises.flatMap((e) => e.sets);
	const completedSets = allSets.filter((s) => s.completed).length;
	const incompleteSets = allSets.length - completedSets;
	const volumeKg = formatKg(workoutVolumeGrams(allSets));

	function startRest(seconds: number) {
		setRest((prev) => ({ nonce: (prev?.nonce ?? 0) + 1, seconds }));
	}

	function handleFinish() {
		if (finishWorkout.isPending) return;
		// Disarm the null-workout guard *before* mutating — the mutation's
		// invalidation refetches `workout.active` to null, and the guard must
		// not bounce us to /workouts while we navigate to the history detail.
		leavingRef.current = true;
		finishWorkout.mutate(
			{ id: workout.id },
			{
				onSuccess: () => {
					toast(t`Workout saved`);
					// Land on the just-finished workout's history detail — the recap
					// is nicer closure than bouncing back to the hub.
					navigate({
						to: "/workouts/history/$workoutId",
						params: { workoutId: workout.id },
					});
				},
				onError: (e) => {
					// Staying on this screen — re-arm the guard.
					leavingRef.current = false;
					setOverlay(null);
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	function handleDiscard() {
		if (discardWorkout.isPending) return;
		// Same guard-vs-navigation race as handleFinish (both land on the hub
		// here, but the explicit navigate must not be doubled by the guard).
		leavingRef.current = true;
		discardWorkout.mutate(
			{ id: workout.id },
			{
				onSuccess: () => {
					toast(t`Workout discarded`);
					navigate({ to: "/workouts" });
				},
				onError: (e) => {
					leavingRef.current = false;
					setOverlay(null);
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	return (
		<div
			className={cn(
				"flex flex-1 flex-col",
				// Keep the footer reachable above the fixed rest-timer bar.
				rest && "pb-28",
			)}
		>
			{/* Sticky header — the route has no app-bar, so this is the top chrome. */}
			<header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
				<div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2">
					{/* Minimize: back to the hub, workout stays active. */}
					<Button
						variant="ghost"
						size="icon"
						className="size-11 shrink-0"
						asChild
					>
						<Link to="/workouts" aria-label={t`Back to workouts`}>
							<ChevronDown className="size-5" />
						</Link>
					</Button>
					<div className="flex min-w-0 flex-1 flex-col">
						<h1 className="truncate font-medium text-base">{workout.name}</h1>
						<p className="text-muted-foreground text-xs tabular-nums">
							<ElapsedTicker startedAt={workout.startedAt} /> ·{" "}
							<Trans>
								{completedSets}/{allSets.length} sets
							</Trans>{" "}
							· {volumeKg} kg
						</p>
					</div>
				</div>
			</header>

			<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-8">
				{workout.exercises.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						<Trans>No exercises yet — add one to start logging.</Trans>
					</p>
				) : (
					workout.exercises.map((exercise) => (
						<WorkoutExerciseCard
							key={exercise.id}
							exercise={exercise}
							onRestStart={startRest}
						/>
					))
				)}

				<Button
					variant="outline"
					className="h-11 w-full"
					onClick={() => setOverlay("picker")}
				>
					<Plus aria-hidden="true" />
					<Trans>Add exercise</Trans>
				</Button>

				{/* Footer actions */}
				<div className="mt-2 flex flex-col gap-2">
					<Button
						className="h-12 w-full"
						disabled={completedSets === 0}
						onClick={() => setOverlay("finish")}
					>
						<Trans>Finish workout</Trans>
					</Button>
					{completedSets === 0 && (
						<p className="text-center text-muted-foreground text-xs">
							<Trans>Complete at least one set to finish.</Trans>
						</p>
					)}
					<Button
						variant="ghost"
						className="h-11 w-full text-destructive hover:text-destructive"
						onClick={() => setOverlay("discard")}
					>
						<Trans>Discard workout</Trans>
					</Button>
				</div>
			</div>

			{/* Add-exercise drawer — reuses the routine builder's picker. */}
			<ExercisePicker
				open={overlay === "picker"}
				onOpenChange={(open) => setOverlay(open ? "picker" : null)}
				addedExerciseIds={workout.exercises.map((e) => e.exerciseId)}
				onPick={(exercise) =>
					addExercise.mutate(
						{ workoutId: workout.id, exerciseId: exercise.id },
						{
							onError: (e) => {
								toast.error(
									getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"),
								);
							},
						},
					)
				}
			/>

			{/* Finish confirm — mentions that incomplete sets are dropped (PRD 8). */}
			<AlertDialog
				open={overlay === "finish"}
				onOpenChange={(open) => setOverlay(open ? "finish" : null)}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>
							<Trans>Finish workout?</Trans>
						</AlertDialogTitle>
						<AlertDialogDescription>
							{incompleteSets > 0 ? (
								<Plural
									value={incompleteSets}
									one="Only completed sets are saved — # unchecked set will be discarded."
									other="Only completed sets are saved — # unchecked sets will be discarded."
								/>
							) : (
								<Trans>All sets are checked off. Nice work!</Trans>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Trans>Cancel</Trans>
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleFinish}>
							<Trans>Finish</Trans>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Discard confirm */}
			<AlertDialog
				open={overlay === "discard"}
				onOpenChange={(open) => setOverlay(open ? "discard" : null)}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>
							<Trans>Discard this workout?</Trans>
						</AlertDialogTitle>
						<AlertDialogDescription>
							<Trans>
								Everything you logged in this workout will be deleted. This
								can't be undone.
							</Trans>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<Trans>Cancel</Trans>
						</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={handleDiscard}>
							<Trans>Discard</Trans>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Rest timer — pure client state; key remounts on each new check-off. */}
			{rest && (
				<RestTimerBar
					key={rest.nonce}
					totalSeconds={rest.seconds}
					onClose={() => setRest(null)}
				/>
			)}
		</div>
	);
}
