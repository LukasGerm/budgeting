/**
 * StreakChip — a quiet chip in the home header reflecting restraint back at the
 * user. It headlines the **under-rate** streak (the number that actually grows
 * day to day); tapping it opens a small panel with current + best for both the
 * under-rate and the stricter **no-spend** streak.
 *
 * Deliberately understated, per the app's honest-figure ethos: no confetti, no
 * milestones, no encouragement copy, and a broken streak simply reads 0. When
 * there is no streak yet (0), the chip renders nothing rather than showing a
 * zero badge — there's nothing to reflect back.
 *
 * Streaks at the lookback-window length are displayed capped (e.g. "90+"), so
 * the chip never implies more history than was actually examined.
 */

import { Flame } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { STREAK_WINDOW_DAYS, type StreakResult } from "#/domain";

/** Render a streak count, capped at the window length as "N+". */
function capped(value: number): string {
	return value >= STREAK_WINDOW_DAYS ? `${STREAK_WINDOW_DAYS}+` : `${value}`;
}

function dayWord(n: number): string {
	return n === 1 ? "day" : "days";
}

export function StreakChip({ streaks }: { streaks: StreakResult }) {
	const headline = streaks.underRate.current;
	// Nothing to reflect back yet — stay silent rather than show a 0 badge.
	if (headline === 0) return null;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label={`Restraint streak: ${headline} ${dayWord(headline)} under rate. Tap for details.`}
				>
					<Flame className="size-3.5" aria-hidden="true" />
					<span className="tabular-nums">{capped(headline)}</span>
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-56">
				<div className="flex flex-col gap-3">
					<StreakLine
						label="Under rate"
						current={streaks.underRate.current}
						best={streaks.underRate.best}
					/>
					<StreakLine
						label="No spend"
						current={streaks.noSpend.current}
						best={streaks.noSpend.best}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function StreakLine({
	label,
	current,
	best,
}: {
	label: string;
	current: number;
	best: number;
}) {
	return (
		<div className="flex items-baseline justify-between gap-4">
			<span className="text-sm">{label}</span>
			<span className="text-muted-foreground text-sm tabular-nums">
				{capped(current)} {dayWord(current)} · best {capped(best)}
			</span>
		</div>
	);
}
