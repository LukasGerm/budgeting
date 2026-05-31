/**
 * TodayChecklist — compact top-of-tab logging surface for the Habits page.
 *
 * One row per habit: icon · name · streak badge · checkbox.
 * Purely presentational — no hooks, no state, no effects.
 * The page owns `useToggleCompletion` and passes the wired callback here,
 * so this component can be rendered without any provider in tests.
 *
 * Slice 6.
 */

import { resolveHabitIcon } from "#/components/habits/habit-icons";
import { HabitStreakBadge } from "#/components/habits/habit-streak-badge";
import { Card, CardContent, CardHeader } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
import type { HabitWithStats } from "#/hooks/use-habits";

interface TodayChecklistProps {
	habits: HabitWithStats[];
	/**
	 * Called when the user taps a row's checkbox.
	 * `currentlyDone` reflects the CURRENT state; the page flips it before
	 * calling the mutation (`done: !currentlyDone`).
	 */
	onToggleToday: (habitId: string, currentlyDone: boolean) => void;
}

export function TodayChecklist({ habits, onToggleToday }: TodayChecklistProps) {
	return (
		<Card>
			<CardHeader className="px-4 pb-2 pt-4">
				<p className="font-medium text-sm leading-none">Today</p>
			</CardHeader>
			<CardContent className="px-4 pb-3">
				<ul className="flex flex-col divide-y divide-border">
					{habits.map((habit) => {
						const Icon = resolveHabitIcon(habit.icon);
						return (
							<li
								key={habit.id}
								className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
							>
								{/* Icon in habit colour */}
								<Icon
									className="size-4 shrink-0"
									style={{ color: habit.color }}
									aria-hidden="true"
								/>

								{/* Habit name */}
								<span className="min-w-0 flex-1 truncate text-sm">
									{habit.name}
								</span>

								{/* Streak badge */}
								<HabitStreakBadge streak={habit.streak} />

								{/* Checkbox — right-most */}
								<Checkbox
									checked={habit.todayDone}
									aria-label={`Mark ${habit.name} done today`}
									onCheckedChange={() =>
										onToggleToday(habit.id, habit.todayDone)
									}
								/>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
