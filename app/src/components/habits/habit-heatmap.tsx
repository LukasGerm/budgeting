/**
 * HabitHeatmap — GitHub-style contribution grid for a single habit.
 *
 * Renders the grid returned by `buildHeatmap` verbatim:
 *   - `weeks.length` flex-1 columns (oldest left, newest right).
 *   - Each column is a flex-col of 7 cells (Sunday index 0 → Saturday index 6).
 *   - All columns share the available width via `flex-1 min-w-0`, so the grid
 *     always scales to the container width regardless of `HEATMAP_WEEK_COUNT`
 *     — this is what guarantees fit-to-width at any phone width with no
 *     horizontal scroll.
 *
 * Cell state styling:
 *   - `done`   → filled with the habit's assigned color via inline `style`.
 *   - `missed` → muted (`bg-muted`), low emphasis.
 *   - `future` → faintest (`bg-muted/40`), visually disabled (non-interactive).
 *   - today    → `ring-1 ring-foreground/60` overlay regardless of done/missed
 *     state so the user can orient in the grid.
 *
 * Interactivity (slice 5):
 *   - Non-future cells (done, missed, today) are `<button type="button">` elements
 *     that call `onToggleDay(isoDay, currentlyDone)` on click. This lets the
 *     parent hook the optimistic mutation without the heatmap knowing about tRPC.
 *   - Future cells remain plain `<div>`s — no handler, no keyboard focus.
 */

import { useLingui } from "@lingui/react/macro";
import type { CSSProperties } from "react";
import { type HeatmapCell as DomainHeatmapCell, dayKey } from "#/domain";
import { localDateToIsoDay } from "#/hooks/use-habits";
import { useFormat } from "#/i18n/use-format";

interface HabitHeatmapProps {
	/** Pre-built grid from `buildHeatmap` — pass the habit's `heatmap.weeks`. */
	weeks: DomainHeatmapCell[][];
	/** The habit's assigned color; used for `done` cells. */
	color: string;
	/** Loader-provided "today" (startOfDay); used to detect today's cell. */
	now: Date;
	/**
	 * Called when a non-future cell is tapped.
	 * `isoDay` is "YYYY-MM-DD"; `currentlyDone` reflects the cell's current state
	 * so the parent can flip it (`done: !currentlyDone`).
	 * Omitting this prop makes all cells non-interactive (e.g. in tests that don't
	 * need the toggle).
	 */
	onToggleDay?: (isoDay: string, currentlyDone: boolean) => void;
}

interface CellProps {
	cell: DomainHeatmapCell;
	color: string;
	isToday: boolean;
	/** Locale-aware formatted date string (from useFormat().formatDate). */
	formattedDate: string;
	/** Translated "done" state label. */
	stateLabel: string;
	/** Translated action label ("tap to mark done" or "tap to unmark"). */
	actionLabel: string;
	onToggleDay?: (isoDay: string, currentlyDone: boolean) => void;
}

function Cell({
	cell,
	color,
	isToday,
	formattedDate,
	stateLabel,
	actionLabel,
	onToggleDay,
}: CellProps) {
	const isDone = cell.state === "done";
	const isFuture = cell.state === "future";

	const className = [
		"aspect-square rounded-[2px]",
		// Background: done uses inline style (dynamic color); others use Tailwind.
		isDone ? "" : isFuture ? "bg-muted/40" : "bg-muted",
		// Today gets a ring overlay so the user can orient regardless of state.
		isToday ? "ring-1 ring-foreground/60" : "",
	]
		.filter(Boolean)
		.join(" ");

	const style: CSSProperties | undefined = isDone
		? { backgroundColor: color }
		: undefined;

	// Future cells are non-interactive divs — the user cannot "complete" a day
	// that hasn't happened yet (user story 15).
	if (isFuture) {
		return (
			<div
				role="img"
				data-state={cell.state}
				data-today={isToday ? "true" : undefined}
				aria-label={formattedDate}
				title={formattedDate}
				className={className}
				style={style}
			/>
		);
	}

	// Non-future cells are toggle buttons. The accessible label describes both
	// the date and the current state so screen-reader users know what tapping
	// will do. The tiny size is intentional (fit-to-width design constraint) —
	// we don't add min-w/min-h that would break the grid layout.
	const ariaLabel = `${formattedDate}: ${stateLabel} — ${actionLabel}`;

	return (
		<button
			type="button"
			data-state={cell.state}
			data-today={isToday ? "true" : undefined}
			aria-label={ariaLabel}
			title={formattedDate}
			className={className}
			style={style}
			onClick={
				onToggleDay
					? () => onToggleDay(localDateToIsoDay(cell.date), isDone)
					: undefined
			}
		/>
	);
}

export function HabitHeatmap({
	weeks,
	color,
	now,
	onToggleDay,
}: HabitHeatmapProps) {
	const todayKey = dayKey(now);
	const { formatDate } = useFormat();
	const { t } = useLingui();

	// Pre-translate labels once per render to avoid repeated string creation in
	// the cell render loop.
	const doneLabelText = t`done`;
	const notDoneLabelText = t`not done`;
	const tapToUnmarkText = t`tap to unmark`;
	const tapToMarkDoneText = t`tap to mark done`;
	const completionHistoryLabel = t`Completion history`;

	return (
		<div
			className="flex w-full gap-[2px]"
			role="img"
			aria-label={completionHistoryLabel}
		>
			{weeks.map((column, wi) => (
				// flex-1 min-w-0: each column shares available width equally and
				// cannot overflow its container, ensuring fit-to-width at phone width.
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: week columns are positional; no stable key
					key={wi}
					className="flex min-w-0 flex-1 flex-col gap-[2px]"
				>
					{column.map((cell) => {
						const isDone = cell.state === "done";
						const stateLabel = isDone ? doneLabelText : notDoneLabelText;
						const actionLabel = isDone ? tapToUnmarkText : tapToMarkDoneText;
						return (
							<Cell
								key={cell.key}
								cell={cell}
								color={color}
								isToday={cell.key === todayKey}
								formattedDate={formatDate(cell.date, "long")}
								stateLabel={stateLabel}
								actionLabel={actionLabel}
								onToggleDay={onToggleDay}
							/>
						);
					})}
				</div>
			))}
		</div>
	);
}
