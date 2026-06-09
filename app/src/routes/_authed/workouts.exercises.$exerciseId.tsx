/**
 * Exercise progress screen — per-exercise training history: PR + est-1RM
 * stat cards, two line charts (best set weight and session volume over
 * time), and a session log linking back to each workout's detail.
 *
 * Reached from the history detail (exercise name), the live workout's
 * exercise overflow menu, and the session log of other exercises — so the
 * back affordance pops the real history when there is one (live workout →
 * back lands on the live workout) and falls back to the hub on a hard load.
 *
 * The loader prefetches `workout.exerciseProgress { exerciseId }`; an
 * exercise that isn't visible to the caller throws a typed NOT_FOUND which
 * surfaces through the route error boundary.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import {
	createFileRoute,
	Link,
	useCanGoBack,
	useRouter,
} from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LineChart } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { ProgressLineChart } from "#/components/workouts/progress-line-chart";
import { useWorkoutLabels } from "#/components/workouts/workout-labels";
import { formatKg } from "#/domain";
import { useExerciseProgress } from "#/hooks/use-workout-history";
import { useFormat } from "#/i18n/use-format";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/workouts/exercises/$exerciseId")(
	{
		loader: async ({ context, params }) => {
			await withLoginRedirect(() =>
				context.queryClient.ensureQueryData(
					context.trpc.workout.exerciseProgress.queryOptions({
						exerciseId: params.exerciseId,
					}),
				),
			);
		},
		component: ExerciseProgressPage,
	},
);

/** Stat card: "PR — 100 kg" / "Est. 1RM — 133.3 kg"; "—" when no data. */
function StatCard({
	label,
	grams,
}: {
	label: ReactNode;
	grams: number | null;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-1 p-4">
				<span className="text-muted-foreground text-xs">{label}</span>
				<span className="font-medium text-lg tabular-nums">
					{grams != null ? `${formatKg(grams)} kg` : "—"}
				</span>
			</CardContent>
		</Card>
	);
}

function ExerciseProgressPage() {
	const { exerciseId } = Route.useParams();
	const progress = useExerciseProgress(exerciseId);
	const router = useRouter();
	const canGoBack = useCanGoBack();
	const { t } = useLingui();
	const { formatDate } = useFormat();
	const labels = useWorkoutLabels();

	// msgid "Back" alone is the BACK muscle group ("Rücken") — the navigation
	// label needs its own context so German doesn't collide.
	const backLabel = t({ message: "Back", context: "navigation" });

	const { exercise, points } = progress;
	const weightPoints = points.map((p) => ({
		label: formatDate(p.finishedAt, "dayMonth"),
		grams: p.bestSetWeightGrams,
	}));
	const volumePoints = points.map((p) => ({
		label: formatDate(p.finishedAt, "dayMonth"),
		grams: p.volumeGrams,
	}));
	// The log reads newest-first (points arrive oldest-first for the charts).
	const sessions = [...points].reverse();

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header className="flex items-center gap-2">
				{canGoBack ? (
					<Button
						variant="ghost"
						size="icon"
						className="-ml-3 size-11 shrink-0"
						aria-label={backLabel}
						onClick={() => router.history.back()}
					>
						<ChevronLeft className="size-5" />
					</Button>
				) : (
					<Button
						variant="ghost"
						size="icon"
						className="-ml-3 size-11 shrink-0"
						asChild
					>
						<Link to="/workouts" aria-label={t`Back to workouts`}>
							<ChevronLeft className="size-5" />
						</Link>
					</Button>
				)}
				<div className="flex min-w-0 flex-1 flex-col">
					{/* Exercise names are data, not chrome — rendered verbatim. */}
					<h1 className="truncate font-medium text-lg">{exercise.name}</h1>
					<p className="truncate text-muted-foreground text-xs">
						{labels.muscleGroup[exercise.muscleGroup]} ·{" "}
						{labels.equipment[exercise.equipment]}
					</p>
				</div>
			</header>

			{/* Headline stats */}
			<div className="grid grid-cols-2 gap-3">
				<StatCard
					label={<Trans>PR (heaviest set)</Trans>}
					grams={progress.prWeightGrams}
				/>
				<StatCard
					label={<Trans>Est. 1RM</Trans>}
					grams={progress.bestEst1RmGrams}
				/>
			</div>

			{points.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-8 text-center">
						<LineChart
							className="size-10 text-muted-foreground/50"
							aria-hidden="true"
						/>
						<div className="flex flex-col gap-1">
							<p className="font-medium text-sm">
								<Trans>No sessions yet</Trans>
							</p>
							<p className="text-muted-foreground text-sm">
								<Trans>
									Log this exercise in a workout to start tracking progress.
								</Trans>
							</p>
						</div>
					</CardContent>
				</Card>
			) : (
				<>
					<ProgressLineChart
						title={<Trans>Best set weight</Trans>}
						seriesLabel={t`Best set`}
						points={weightPoints}
					/>
					<ProgressLineChart
						title={<Trans>Session volume</Trans>}
						seriesLabel={t`Volume`}
						points={volumePoints}
					/>

					{/* Session log — newest first, each linking to its workout detail. */}
					<section
						className="flex flex-col gap-3"
						aria-labelledby="sessions-heading"
					>
						<h2 id="sessions-heading" className="font-medium text-sm">
							<Trans>Sessions</Trans>
						</h2>
						<div className="flex flex-col gap-2">
							{sessions.map((session) => (
								<Card
									key={session.workoutId}
									className="transition-colors hover:bg-accent/50"
								>
									<CardContent className="p-0">
										<Link
											to="/workouts/history/$workoutId"
											params={{ workoutId: session.workoutId }}
											className="flex min-h-11 items-center gap-3 p-4"
										>
											<div className="flex min-w-0 flex-1 flex-col gap-0.5">
												<span className="font-medium text-sm tabular-nums">
													{formatDate(session.finishedAt, "numeric")}
												</span>
												<span className="text-muted-foreground text-xs tabular-nums">
													<Trans>
														Best set {formatKg(session.bestSetWeightGrams)} kg ×{" "}
														{session.bestSetReps}
													</Trans>{" "}
													·{" "}
													<Trans>
														Volume {formatKg(session.volumeGrams)} kg
													</Trans>
												</span>
											</div>
											<ChevronRight
												className="size-4 shrink-0 text-muted-foreground"
												aria-hidden="true"
											/>
										</Link>
									</CardContent>
								</Card>
							))}
						</div>
					</section>
				</>
			)}
		</div>
	);
}
