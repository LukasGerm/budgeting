/**
 * WorkoutHistoryCard — one finished workout as a tappable summary card:
 * name, date, duration, set count, volume, and an exercise-names preview
 * line. Links to the read-only detail screen. Shared by the hub's "Recent
 * workouts" section and the /workouts/history list (same wire shape, same
 * cache entry — see `use-workout-history.ts`).
 */

import { Plural } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "#/components/ui/card";
import { formatDuration, formatKg } from "#/domain";
import type { WorkoutHistoryItem } from "#/hooks/use-workout-history";
import { useFormat } from "#/i18n/use-format";

interface WorkoutHistoryCardProps {
	workout: WorkoutHistoryItem;
}

export function WorkoutHistoryCard({ workout }: WorkoutHistoryCardProps) {
	const { formatDate } = useFormat();
	const durationSeconds =
		(workout.finishedAt.getTime() - workout.startedAt.getTime()) / 1000;

	return (
		<Card className="transition-colors hover:bg-accent/50">
			<CardContent className="p-0">
				<Link
					to="/workouts/history/$workoutId"
					params={{ workoutId: workout.id }}
					className="flex min-h-11 items-center gap-3 p-4"
				>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="truncate font-medium text-sm">{workout.name}</span>
						<span className="text-muted-foreground text-xs tabular-nums">
							{formatDate(workout.finishedAt, "numeric")} ·{" "}
							{formatDuration(durationSeconds)} ·{" "}
							<Plural value={workout.totalSets} one="# set" other="# sets" /> ·{" "}
							{formatKg(workout.volumeGrams)} kg
						</span>
						{workout.exerciseNames.length > 0 && (
							// Exercise names are data, not chrome — rendered verbatim.
							<span className="truncate text-muted-foreground text-xs">
								{workout.exerciseNames.join(" · ")}
							</span>
						)}
					</div>
					<ChevronRight
						className="size-4 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
				</Link>
			</CardContent>
		</Card>
	);
}
