/**
 * Workout history list — every finished workout, newest first, as summary
 * cards linking to the read-only detail screen.
 *
 * The list is the `workout.history` cursor-paginated infinite query; the
 * loader `ensureInfiniteQueryData`s the first page (same options object as
 * the suspense hook — see `use-workout-history.ts`) so the first paint is
 * server-rendered, and "Load more" appends pages client-side.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Dumbbell } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { WorkoutHistoryCard } from "#/components/workouts/workout-history-card";
import {
	useWorkoutHistory,
	workoutHistoryQueryOptions,
} from "#/hooks/use-workout-history";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/workouts/history/")({
	loader: async ({ context }) => {
		await withLoginRedirect(() =>
			context.queryClient.ensureInfiniteQueryData(
				workoutHistoryQueryOptions(context.trpc),
			),
		);
	},
	component: WorkoutHistoryPage,
});

function WorkoutHistoryPage() {
	const { items, hasNextPage, isFetchingNextPage, fetchNextPage } =
		useWorkoutHistory();
	const { t } = useLingui();

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header className="flex items-center gap-2">
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
				<h1 className="font-medium text-lg">
					<Trans>Workout history</Trans>
				</h1>
			</header>

			{items.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center gap-4 py-8 text-center">
						<Dumbbell
							className="size-10 text-muted-foreground/50"
							aria-hidden="true"
						/>
						<div className="flex flex-col gap-1">
							<p className="font-medium text-sm">
								<Trans>No finished workouts yet</Trans>
							</p>
							<p className="text-muted-foreground text-sm">
								<Trans>
									Finish your first workout and it will show up here.
								</Trans>
							</p>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="flex flex-col gap-3">
					{items.map((workout) => (
						<WorkoutHistoryCard key={workout.id} workout={workout} />
					))}
					{hasNextPage && (
						<Button
							variant="outline"
							className="h-11 w-full"
							disabled={isFetchingNextPage}
							onClick={fetchNextPage}
						>
							{isFetchingNextPage ? (
								<Trans>Loading…</Trans>
							) : (
								<Trans>Load more</Trans>
							)}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
