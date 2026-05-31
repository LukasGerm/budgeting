/**
 * HabitStreakBadge — compact flame badge showing the current streak for a habit.
 *
 * Styled after `StreakChip` (Flame icon + tabular-nums count) but:
 *   - Shows the current streak only — no popover, no best-streak.
 *   - Always renders, including 0 — the card header should honestly reflect a
 *     reset streak (unlike the ambient home chip which hides 0).
 */

import { Flame } from "lucide-react";

interface HabitStreakBadgeProps {
	/** Current consecutive-done streak (0 means no active streak). */
	streak: number;
}

export function HabitStreakBadge({ streak }: HabitStreakBadgeProps) {
	return (
		<output
			className="inline-flex items-center gap-1 text-muted-foreground text-sm"
			aria-label={`Current streak: ${streak} ${streak === 1 ? "day" : "days"}`}
		>
			<Flame className="size-3.5 shrink-0" aria-hidden="true" />
			<span className="tabular-nums">{streak}</span>
		</output>
	);
}
