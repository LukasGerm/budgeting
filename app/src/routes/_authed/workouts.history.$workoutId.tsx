/**
 * Read-only detail of one finished workout: header stats (date, duration,
 * sets, volume) and one card per exercise with its saved set rows. Finished
 * workouts contain only completed sets, densely renumbered — nothing here is
 * editable.
 *
 * Exercise names link to the per-exercise progress screen.
 *
 * The loader prefetches `workout.get { id }`; a workout that isn't the
 * caller's finished workout throws a typed NOT_FOUND which surfaces through
 * the route error boundary (the routine-edit pattern).
 */

import { Plural, useLingui } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { useWorkoutLabels } from "#/components/workouts/workout-labels";
import { formatDuration, formatKg, workoutVolumeGrams } from "#/domain";
import {
	useWorkoutDetail,
	type WorkoutDetailSet,
} from "#/hooks/use-workout-history";
import { useFormat } from "#/i18n/use-format";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/workouts/history/$workoutId")({
	loader: async ({ context, params }) => {
		await withLoginRedirect(() =>
			context.queryClient.ensureQueryData(
				context.trpc.workout.get.queryOptions({ id: params.workoutId }),
			),
		);
	},
	component: WorkoutDetailPage,
});

/** "80 kg × 8" for a saved set; null weight (bodyweight) renders as "—". */
function setLine(set: WorkoutDetailSet): string {
	const weight =
		set.weightGrams != null ? `${formatKg(set.weightGrams)} kg` : "—";
	const reps = set.reps != null ? `${set.reps}` : "—";
	return `${weight} × ${reps}`;
}

function WorkoutDetailPage() {
	const { workoutId } = Route.useParams();
	const workout = useWorkoutDetail(workoutId);
	const { t } = useLingui();
	const { formatDate } = useFormat();
	const labels = useWorkoutLabels();

	const allSets = workout.exercises.flatMap((e) => e.sets);
	// Saved sets are completed by definition (finish dropped the rest).
	const volumeKg = formatKg(
		workoutVolumeGrams(allSets.map((s) => ({ ...s, completed: true }))),
	);
	const durationSeconds =
		(workout.finishedAt.getTime() - workout.startedAt.getTime()) / 1000;

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					className="-ml-3 size-11 shrink-0"
					asChild
				>
					<Link to="/workouts/history" aria-label={t`Back to history`}>
						<ChevronLeft className="size-5" />
					</Link>
				</Button>
				<div className="flex min-w-0 flex-1 flex-col">
					<h1 className="truncate font-medium text-lg">{workout.name}</h1>
					<p className="text-muted-foreground text-xs tabular-nums">
						{formatDate(workout.finishedAt, "numeric")} ·{" "}
						{formatDuration(durationSeconds)} ·{" "}
						<Plural value={allSets.length} one="# set" other="# sets" /> ·{" "}
						{volumeKg} kg
					</p>
				</div>
			</header>

			<div className="flex flex-col gap-4">
				{workout.exercises.map((exercise) => (
					<Card key={exercise.id}>
						<CardContent className="flex flex-col gap-3 p-4">
							{/* Name links to the exercise's progress screen. */}
							<Link
								to="/workouts/exercises/$exerciseId"
								params={{ exerciseId: exercise.exerciseId }}
								className="-m-2 flex min-h-11 items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent/50"
							>
								<div className="flex min-w-0 flex-1 flex-col">
									{/* Exercise names are data, not chrome — rendered verbatim. */}
									<span className="truncate font-medium text-sm">
										{exercise.name}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{labels.muscleGroup[exercise.muscleGroup]}
									</span>
								</div>
								<ChevronRight
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
							</Link>

							<div className="flex flex-col gap-1">
								{exercise.sets.map((set) => (
									<div
										key={set.id}
										className="flex items-center gap-3 py-0.5 text-sm tabular-nums"
									>
										<span className="w-7 font-medium text-muted-foreground">
											{set.setNumber}
										</span>
										<span>{setLine(set)}</span>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
