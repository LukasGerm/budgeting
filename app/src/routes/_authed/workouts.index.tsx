/**
 * Workouts hub — landing page for the workout tracker tab.
 *
 * Slice 3: live workouts are wired — the loader additionally prefetches
 * `workout.active`; a running workout shows a prominent resume banner, the
 * routine cards' Start buttons and "Start empty workout" are live (with the
 * already-active resume-or-discard guard, PRD locked decision 5). Slice 4
 * lights up recent finished workouts + history.
 *
 * Sibling sub-screens land as flat dot-notation routes next to this file
 * (`workouts.routines.new.tsx`, `workouts.active.tsx`, …), which is why the
 * hub is `workouts.index.tsx` rather than `workouts.tsx`.
 *
 * The loader mirrors `habits.tsx`: `ensureQueryData` inside
 * `withLoginRedirect` prefetches the queries so the first paint is
 * server-rendered and the suspense hooks rehydrate the same cache.
 */

import { Plural, Trans, useLingui } from "@lingui/react/macro";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardList, Dumbbell, Play, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { ElapsedTicker } from "#/components/workouts/elapsed-ticker";
import { RoutineCard } from "#/components/workouts/routine-card";
import { StartConflictDialog } from "#/components/workouts/start-conflict-dialog";
import { WorkoutHistoryCard } from "#/components/workouts/workout-history-card";
import { useExercises } from "#/hooks/use-exercises";
import { useRoutines } from "#/hooks/use-routines";
import {
	useActiveWorkout,
	useDiscardWorkout,
	useStartWorkout,
} from "#/hooks/use-workout";
import {
	useRecentWorkouts,
	workoutHistoryQueryOptions,
} from "#/hooks/use-workout-history";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/workouts/")({
	loader: async ({ context }) => {
		await withLoginRedirect(() =>
			Promise.all([
				context.queryClient.ensureQueryData(
					context.trpc.routine.list.queryOptions(),
				),
				context.queryClient.ensureQueryData(
					context.trpc.exercise.list.queryOptions(),
				),
				context.queryClient.ensureQueryData(
					context.trpc.workout.active.queryOptions(),
				),
				// First history page — feeds the "Recent workouts" section and is
				// the same cache entry /workouts/history reads.
				context.queryClient.ensureInfiniteQueryData(
					workoutHistoryQueryOptions(context.trpc),
				),
			]),
		);
	},
	component: WorkoutsHubPage,
});

function WorkoutsHubPage() {
	const navigate = useNavigate();
	const exercises = useExercises();
	const routines = useRoutines();
	const activeWorkout = useActiveWorkout();
	const recentWorkouts = useRecentWorkouts();
	const startWorkout = useStartWorkout();
	const discardWorkout = useDiscardWorkout();
	const { t } = useLingui();
	const getErrorMessage = useErrorMessage();

	// Already-active guard for "Start empty workout" (routine cards own theirs).
	const [conflictOpen, setConflictOpen] = useState(false);

	function startEmptyWorkout() {
		if (startWorkout.isPending) return;
		startWorkout.mutate(
			// Translated display name for a plan-less session (stored verbatim).
			{ name: t`Freestyle workout` },
			{
				onSuccess: () => navigate({ to: "/workouts/active" }),
				onError: (e) => {
					setConflictOpen(false);
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	function handleEmptyClick() {
		if (activeWorkout) {
			setConflictOpen(true);
			return;
		}
		startEmptyWorkout();
	}

	function handleDiscardAndStartEmpty() {
		if (!activeWorkout || discardWorkout.isPending) return;
		discardWorkout.mutate(
			{ id: activeWorkout.id },
			{
				onSuccess: startEmptyWorkout,
				onError: (e) => {
					setConflictOpen(false);
					toast.error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
				},
			},
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header>
				<h1 className="font-medium text-lg">
					<Trans>Workouts</Trans>
				</h1>
				<p className="text-muted-foreground text-sm">
					<Trans>Plan, log, and track your training.</Trans>
				</p>
			</header>

			{/* Resume banner — the one always-visible pointer to a running workout
			    (PRD locked decision 5: no live indicator on the nav tab). */}
			{activeWorkout && (
				<Card className="border-primary/40">
					<CardContent className="flex items-center gap-3 p-4">
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="text-muted-foreground text-xs">
								<Trans>Workout in progress</Trans>
							</span>
							<span className="truncate font-medium text-sm">
								{activeWorkout.name}
							</span>
							<span className="text-muted-foreground text-xs tabular-nums">
								<ElapsedTicker startedAt={activeWorkout.startedAt} />
							</span>
						</div>
						<Button className="h-11 shrink-0" asChild>
							<Link to="/workouts/active">
								<Play aria-hidden="true" />
								<Trans>Resume</Trans>
							</Link>
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Plans (routines) */}
			<section className="flex flex-col gap-3" aria-labelledby="plans-heading">
				<h2 id="plans-heading" className="font-medium text-sm">
					<Trans>Plans</Trans>
				</h2>
				{routines.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center gap-4 py-8 text-center">
							<ClipboardList
								className="size-10 text-muted-foreground/50"
								aria-hidden="true"
							/>
							<div className="flex flex-col gap-1">
								<p className="font-medium text-sm">
									<Trans>No plans yet</Trans>
								</p>
								<p className="text-muted-foreground text-sm">
									<Trans>
										Create a reusable plan with your exercises, sets, and reps.
									</Trans>
								</p>
							</div>
							<Button asChild>
								<Link to="/workouts/routines/new">
									<Trans>New plan</Trans>
								</Link>
							</Button>
						</CardContent>
					</Card>
				) : (
					<>
						{routines.map((routine) => (
							<RoutineCard
								key={routine.id}
								routine={routine}
								activeWorkoutId={activeWorkout?.id ?? null}
							/>
						))}
						<Button variant="outline" className="h-11 w-full" asChild>
							<Link to="/workouts/routines/new">
								<Plus aria-hidden="true" />
								<Trans>New plan</Trans>
							</Link>
						</Button>
					</>
				)}
			</section>

			<Button
				variant="outline"
				className="h-11 w-full"
				disabled={startWorkout.isPending || discardWorkout.isPending}
				onClick={handleEmptyClick}
			>
				<Dumbbell aria-hidden="true" />
				<Trans>Start empty workout</Trans>
			</Button>

			{/* Recent workouts — last 3 finished, linking into history */}
			<section className="flex flex-col gap-3" aria-labelledby="recent-heading">
				<div className="flex items-center justify-between">
					<h2 id="recent-heading" className="font-medium text-sm">
						<Trans>Recent workouts</Trans>
					</h2>
					{recentWorkouts.length > 0 && (
						<Link
							to="/workouts/history"
							className="flex min-h-11 items-center text-muted-foreground text-sm underline-offset-4 hover:underline"
						>
							<Trans>All workouts</Trans>
						</Link>
					)}
				</div>
				{recentWorkouts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						<Trans>Finished workouts will show up here.</Trans>
					</p>
				) : (
					recentWorkouts.map((workout) => (
						<WorkoutHistoryCard key={workout.id} workout={workout} />
					))
				)}
			</section>

			{/* SSR-prefetched library size — the picker drawer uses this data. */}
			<p className="text-muted-foreground/70 text-xs">
				<Plural
					value={exercises.length}
					one="# exercise in your library"
					other="# exercises in your library"
				/>
			</p>

			<StartConflictDialog
				open={conflictOpen}
				onOpenChange={setConflictOpen}
				onResume={() => navigate({ to: "/workouts/active" })}
				onDiscardAndStart={handleDiscardAndStartEmpty}
			/>
		</div>
	);
}
