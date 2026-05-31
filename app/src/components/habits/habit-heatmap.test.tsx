// @vitest-environment jsdom

import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHeatmap, dayKey } from "#/domain";
import { HEATMAP_WEEK_COUNT } from "#/hooks/use-habits";
import { renderWithI18n } from "#/i18n/test-utils";
import { HabitHeatmap } from "./habit-heatmap";

afterEach(() => {
	document.body.innerHTML = "";
});

// Fixed "today" for deterministic tests: a Wednesday so the week is partially
// filled with future cells (Thu/Fri/Sat) and partially with past cells.
// 2025-03-19 is a Wednesday.
const TODAY = new Date(2025, 2, 19); // month is 0-indexed: 2 = March
const HABIT_COLOR = "#4ade80";

// Helper that renders with en locale (sufficient for structural assertions).
function renderHeatmap(
	completions: string[] = [],
	onToggleDay?: (isoDay: string, done: boolean) => void,
) {
	const { weeks } = buildHeatmap(completions, TODAY, HEATMAP_WEEK_COUNT);
	return renderWithI18n(
		"en",
		"EUR",
		<HabitHeatmap
			weeks={weeks}
			color={HABIT_COLOR}
			now={TODAY}
			onToggleDay={onToggleDay}
		/>,
	);
}

describe("HabitHeatmap", () => {
	it("renders the correct number of week columns", () => {
		const { weeks } = buildHeatmap([], TODAY, HEATMAP_WEEK_COUNT);
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<HabitHeatmap weeks={weeks} color={HABIT_COLOR} now={TODAY} />,
		);

		// One column div per week; they are direct children of the grid container.
		// The outermost div is the grid; its children are the column divs.
		const gridEl = container.firstChild as HTMLElement;
		expect(gridEl.children).toHaveLength(HEATMAP_WEEK_COUNT);
	});

	it("marks done cells with data-state=done", () => {
		// Mark exactly one completion: today itself.
		const todayDayKey = dayKey(TODAY);
		const { weeks } = buildHeatmap([todayDayKey], TODAY, HEATMAP_WEEK_COUNT);
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<HabitHeatmap weeks={weeks} color={HABIT_COLOR} now={TODAY} />,
		);

		const doneCells = container.querySelectorAll("[data-state='done']");
		expect(doneCells.length).toBe(1);
	});

	it("marks missed cells with data-state=missed for past un-completed days", () => {
		// No completions at all — all past days should be missed.
		const { container } = renderHeatmap();

		const missedCells = container.querySelectorAll("[data-state='missed']");
		// There should be multiple missed cells (all past days have no completion).
		expect(missedCells.length).toBeGreaterThan(0);
	});

	it("marks future cells with data-state=future", () => {
		// TODAY is a Wednesday; Thu/Fri/Sat of the same week are future.
		const { container } = renderHeatmap();

		const futureCells = container.querySelectorAll("[data-state='future']");
		// At least Thu, Fri, Sat of the current week should be future.
		expect(futureCells.length).toBeGreaterThanOrEqual(3);
	});

	it("marks today's cell with data-today=true", () => {
		const { container } = renderHeatmap();

		const todayCells = container.querySelectorAll("[data-today='true']");
		expect(todayCells.length).toBe(1);
	});

	it("today cell is marked even when it is done", () => {
		const todayDayKey = dayKey(TODAY);
		const { weeks } = buildHeatmap([todayDayKey], TODAY, HEATMAP_WEEK_COUNT);
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<HabitHeatmap weeks={weeks} color={HABIT_COLOR} now={TODAY} />,
		);

		const todayCell = container.querySelector("[data-today='true']");
		expect(todayCell).toBeTruthy();
		// It should also be marked done.
		expect(todayCell?.getAttribute("data-state")).toBe("done");
	});

	it("today cell is marked when it is missed (not yet completed)", () => {
		// No completions — today will be missed and still highlighted.
		const { container } = renderHeatmap();

		const todayCell = container.querySelector("[data-today='true']");
		expect(todayCell).toBeTruthy();
		expect(todayCell?.getAttribute("data-state")).toBe("missed");
	});

	it("renders the grid container with a translated aria-label — en", () => {
		const { container } = renderHeatmap();

		const gridEl = container.firstChild as HTMLElement;
		expect(gridEl.getAttribute("aria-label")).toBe("Completion history");
	});

	it("renders the grid container with a translated aria-label — de", () => {
		const { weeks } = buildHeatmap([], TODAY, HEATMAP_WEEK_COUNT);
		const { container } = renderWithI18n(
			"de",
			"EUR",
			<HabitHeatmap weeks={weeks} color={HABIT_COLOR} now={TODAY} />,
		);

		const gridEl = container.firstChild as HTMLElement;
		// German translation: "Abschlusshistorie" (set in the DE catalog)
		expect(gridEl.getAttribute("aria-label")).toBeTruthy();
		expect(gridEl.getAttribute("aria-label")).not.toBe("");
	});

	it("each cell has a title describing the date", () => {
		const { container } = renderHeatmap();

		const cells = container.querySelectorAll("[data-state]");
		// Every cell should have a non-empty title attribute.
		for (const cell of cells) {
			expect(cell.getAttribute("title")).toBeTruthy();
		}
	});

	it("applies the habit color as inline backgroundColor to done cells", () => {
		const todayDayKey = dayKey(TODAY);
		const { weeks } = buildHeatmap([todayDayKey], TODAY, HEATMAP_WEEK_COUNT);
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<HabitHeatmap weeks={weeks} color={HABIT_COLOR} now={TODAY} />,
		);

		const doneCell = container.querySelector("[data-state='done']");
		expect(doneCell).toBeTruthy();
		// The background color is set via inline style; jsdom normalizes hex to rgb.
		// #4ade80 = rgb(74, 222, 128)
		expect((doneCell as HTMLElement).style.backgroundColor).toBe(
			"rgb(74, 222, 128)",
		);
	});

	it("future cells are non-interactive divs (not buttons)", () => {
		const { container } = renderHeatmap();

		const futureCells = container.querySelectorAll("[data-state='future']");
		for (const cell of futureCells) {
			expect(cell.tagName.toLowerCase()).toBe("div");
		}
	});
});

// ---------------------------------------------------------------------------
// Interactivity (slice 5)
// ---------------------------------------------------------------------------

describe("HabitHeatmap interactions", () => {
	// TODAY is 2025-03-19 (Wednesday). Past days are Sunday–Tuesday of the same
	// week and all prior weeks.

	it("non-future cells (missed) are rendered as buttons", () => {
		const { container } = renderHeatmap([], vi.fn());

		const missedCells = container.querySelectorAll("[data-state='missed']");
		expect(missedCells.length).toBeGreaterThan(0);
		for (const cell of missedCells) {
			expect(cell.tagName.toLowerCase()).toBe("button");
		}
	});

	it("non-future cells (done) are rendered as buttons", () => {
		// Mark today as done.
		const todayDayKey = dayKey(TODAY);
		const { container } = renderHeatmap([todayDayKey], vi.fn());

		const doneCells = container.querySelectorAll("[data-state='done']");
		expect(doneCells.length).toBeGreaterThan(0);
		for (const cell of doneCells) {
			expect(cell.tagName.toLowerCase()).toBe("button");
		}
	});

	it("clicking a missed cell calls onToggleDay with the correct ISO day and currentlyDone=false", () => {
		// Use a known past date: 2025-03-17 (Monday, the week before TODAY's week).
		// TODAY = 2025-03-19. dayKey(2025-03-17) = "2025-2-17".
		const onToggleDay = vi.fn();
		const { container } = renderHeatmap([], onToggleDay);

		// Find today's cell (missed, since no completions) and click it.
		const todayCell = container.querySelector(
			"[data-today='true']",
		) as HTMLElement;
		expect(todayCell).toBeTruthy();
		expect(todayCell.getAttribute("data-state")).toBe("missed");

		fireEvent.click(todayCell);

		expect(onToggleDay).toHaveBeenCalledTimes(1);
		// TODAY is 2025-03-19 → ISO "2025-03-19", currentlyDone = false (missed).
		expect(onToggleDay).toHaveBeenCalledWith("2025-03-19", false);
	});

	it("clicking a done cell calls onToggleDay with currentlyDone=true", () => {
		// Mark today as done.
		const todayDayKey = dayKey(TODAY);
		const onToggleDay = vi.fn();
		const { container } = renderHeatmap([todayDayKey], onToggleDay);

		const todayCell = container.querySelector(
			"[data-today='true']",
		) as HTMLElement;
		expect(todayCell?.getAttribute("data-state")).toBe("done");

		fireEvent.click(todayCell);

		expect(onToggleDay).toHaveBeenCalledWith("2025-03-19", true);
	});

	it("clicking a future cell does NOT call onToggleDay", () => {
		const onToggleDay = vi.fn();
		const { container } = renderHeatmap([], onToggleDay);

		const futureCells = container.querySelectorAll("[data-state='future']");
		expect(futureCells.length).toBeGreaterThan(0);
		for (const cell of futureCells) {
			fireEvent.click(cell);
		}

		expect(onToggleDay).not.toHaveBeenCalled();
	});

	it("non-future buttons have an accessible aria-label describing state and action — en", () => {
		const { container } = renderHeatmap([], vi.fn());

		// Today is missed — its aria-label should mention "not done" and "tap to mark done".
		const todayCell = container.querySelector(
			"[data-today='true']",
		) as HTMLElement;
		const label = todayCell?.getAttribute("aria-label") ?? "";
		expect(label).toContain("not done");
		expect(label).toContain("tap to mark done");
	});

	it("done cell aria-label mentions done and tap to unmark — en", () => {
		const todayDayKey = dayKey(TODAY);
		const { container } = renderHeatmap([todayDayKey], vi.fn());

		const todayCell = container.querySelector(
			"[data-today='true']",
		) as HTMLElement;
		const label = todayCell?.getAttribute("aria-label") ?? "";
		expect(label).toContain("done");
		expect(label).toContain("tap to unmark");
	});
});
