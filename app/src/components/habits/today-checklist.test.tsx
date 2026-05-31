// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HabitWithStats } from "#/hooks/use-habits";
import { renderWithI18n } from "#/i18n/test-utils";
import { TodayChecklist } from "./today-checklist";

afterEach(() => {
	document.body.innerHTML = "";
});

/**
 * Build a minimal HabitWithStats fixture. Only the fields TodayChecklist
 * actually reads are meaningful; heatmap weeks are left empty since the
 * component does not render the heatmap.
 */
function makeHabit(
	overrides: Partial<HabitWithStats> & Pick<HabitWithStats, "id" | "name">,
): HabitWithStats {
	return {
		icon: "Droplet",
		color: "#4ade80",
		createdAt: new Date(2025, 0, 1),
		completionDays: [],
		streak: 0,
		heatmap: { weeks: [] },
		todayDone: false,
		...overrides,
	};
}

const habitA = makeHabit({
	id: "a",
	name: "Drink water",
	streak: 5,
	todayDone: true,
});
const habitB = makeHabit({
	id: "b",
	name: "Read a book",
	streak: 0,
	todayDone: false,
});
const habits: HabitWithStats[] = [habitA, habitB];

describe("TodayChecklist", () => {
	it("renders one row per habit", () => {
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<TodayChecklist habits={habits} onToggleToday={vi.fn()} />,
		);
		expect(container.querySelectorAll("li")).toHaveLength(2);
	});

	it("renders each habit name", () => {
		renderWithI18n(
			"en",
			"EUR",
			<TodayChecklist habits={habits} onToggleToday={vi.fn()} />,
		);
		expect(screen.getByText("Drink water")).toBeTruthy();
		expect(screen.getByText("Read a book")).toBeTruthy();
	});

	it("renders each habit's current streak count", () => {
		renderWithI18n(
			"en",
			"EUR",
			<TodayChecklist habits={habits} onToggleToday={vi.fn()} />,
		);
		// HabitStreakBadge renders the streak number as plain text.
		expect(screen.getByText("5")).toBeTruthy();
		expect(screen.getByText("0")).toBeTruthy();
	});

	it("the done habit's checkbox is checked, the undone one is unchecked — en", () => {
		renderWithI18n(
			"en",
			"EUR",
			<TodayChecklist habits={habits} onToggleToday={vi.fn()} />,
		);

		// Checkboxes have aria-label "Mark <name> done today" (en translation).
		const doneCheckbox = screen.getByRole("checkbox", {
			name: "Mark Drink water done today",
		}) as HTMLInputElement;
		const undoneCheckbox = screen.getByRole("checkbox", {
			name: "Mark Read a book done today",
		}) as HTMLInputElement;

		// todayDone=true → checked; todayDone=false → not checked.
		expect(doneCheckbox.getAttribute("data-state")).toBe("checked");
		expect(undoneCheckbox.getAttribute("data-state")).toBe("unchecked");
	});

	it("clicking a checkbox calls onToggleToday with the habit id and its current todayDone", () => {
		const onToggleToday = vi.fn();
		renderWithI18n(
			"en",
			"EUR",
			<TodayChecklist habits={habits} onToggleToday={onToggleToday} />,
		);

		// Click the undone habit's checkbox → should call with (id, false).
		const undoneCheckbox = screen.getByRole("checkbox", {
			name: "Mark Read a book done today",
		});
		fireEvent.click(undoneCheckbox);
		expect(onToggleToday).toHaveBeenCalledTimes(1);
		expect(onToggleToday).toHaveBeenCalledWith("b", false);

		onToggleToday.mockClear();

		// Click the done habit's checkbox → should call with (id, true).
		const doneCheckbox = screen.getByRole("checkbox", {
			name: "Mark Drink water done today",
		});
		fireEvent.click(doneCheckbox);
		expect(onToggleToday).toHaveBeenCalledTimes(1);
		expect(onToggleToday).toHaveBeenCalledWith("a", true);
	});

	it("renders a 'Today' heading — en", () => {
		renderWithI18n(
			"en",
			"EUR",
			<TodayChecklist habits={habits} onToggleToday={vi.fn()} />,
		);
		expect(screen.getByText("Today")).toBeTruthy();
	});

	it("renders habits in array order", () => {
		renderWithI18n(
			"en",
			"EUR",
			<TodayChecklist habits={habits} onToggleToday={vi.fn()} />,
		);
		const items = screen.getAllByRole("listitem");
		expect(items[0].textContent).toContain("Drink water");
		expect(items[1].textContent).toContain("Read a book");
	});

	it("renders a translated heading in German — de", () => {
		renderWithI18n(
			"de",
			"EUR",
			<TodayChecklist habits={habits} onToggleToday={vi.fn()} />,
		);
		// German translation for "Today" (set in the DE catalog)
		expect(screen.getByText("Heute")).toBeTruthy();
	});
});
