/**
 * Habits — daily habit tracker landing page.
 *
 * Slice 3: adds the `habit.list` SSR-prefetch loader, a vertical stack of
 * `HabitCard`s (header only this slice), and the `HabitSheet` create drawer.
 * The empty state's "Create your first habit" CTA now opens the sheet.
 *
 * Slice 4: loader now returns `now` (startOfDay) so the component reads the
 * same value on the server render and client hydration (same approach as
 * `dashboard.tsx` / `index.tsx`). `useHabits(now)` derives streak + heatmap
 * from the loader-stable `now` so SSR and client agree on "today".
 *
 * The loader mirrors `dashboard.tsx`: `ensureQueryData` inside
 * `withLoginRedirect` so first paint is server-rendered with no loading flash.
 */

import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { HabitCard } from "#/components/habits/habit-card";
import { HabitSheet } from "#/components/habits/habit-sheet";
import { TodayChecklist } from "#/components/habits/today-checklist";
import { Button } from "#/components/ui/button";
import { startOfDay } from "#/hooks/use-expenses";
import {
	localDateToIsoDay,
	useHabits,
	useToggleCompletion,
} from "#/hooks/use-habits";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/habits")({
	loader: async ({ context }) => {
		const now = startOfDay(new Date());
		await withLoginRedirect(() =>
			context.queryClient.ensureQueryData(
				context.trpc.habit.list.queryOptions(),
			),
		);
		return { now };
	},
	component: HabitsPage,
});

function HabitsPage() {
	// From the loader so SSR and client hydration agree on `now`.
	const { now } = Route.useLoaderData();
	const habits = useHabits(now);
	const toggle = useToggleCompletion();

	if (habits.length === 0) {
		return (
			<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
				<header>
					<h1 className="font-medium text-lg">Habits</h1>
					<p className="text-muted-foreground text-sm">
						Track your daily routines.
					</p>
				</header>

				<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
					<CalendarCheck
						className="size-12 text-muted-foreground/50"
						aria-hidden="true"
					/>
					<div className="flex flex-col gap-1">
						<p className="font-medium text-sm">No habits yet</p>
						<p className="text-muted-foreground text-sm">
							Build streaks by adding habits you want to do every day.
						</p>
					</div>
					<HabitSheet trigger={<Button>Create your first habit</Button>} />
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header>
				<h1 className="font-medium text-lg">Habits</h1>
				<p className="text-muted-foreground text-sm">
					Track your daily routines.
				</p>
			</header>

			{/* Today checklist — quick top-of-tab logging surface */}
			<TodayChecklist
				habits={habits}
				onToggleToday={(habitId, currentlyDone) =>
					toggle.mutate({
						habitId,
						day: localDateToIsoDay(now),
						done: !currentlyDone,
					})
				}
			/>

			<div className="flex flex-col gap-3">
				{habits.map((habit) => (
					<HabitCard key={habit.id} habit={habit} now={now} />
				))}
			</div>

			{/* FAB — add another habit */}
			<HabitSheet />
		</div>
	);
}
