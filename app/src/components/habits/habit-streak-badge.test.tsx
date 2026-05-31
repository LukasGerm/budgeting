// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HabitStreakBadge } from "./habit-streak-badge";

afterEach(() => {
	document.body.innerHTML = "";
});

describe("HabitStreakBadge", () => {
	it("renders the streak count", () => {
		render(<HabitStreakBadge streak={7} />);
		expect(screen.getByText("7")).toBeTruthy();
	});

	it("renders 0 when streak is 0 (does not hide zero)", () => {
		render(<HabitStreakBadge streak={0} />);
		expect(screen.getByText("0")).toBeTruthy();
	});

	it("renders a flame icon (aria-hidden, not in accessible name)", () => {
		const { container } = render(<HabitStreakBadge streak={5} />);
		// The svg flame icon is aria-hidden; we find it by tagName.
		const svgEl = container.querySelector("svg[aria-hidden='true']");
		expect(svgEl).toBeTruthy();
	});

	it("has a meaningful aria-label describing the streak", () => {
		// The badge renders as <output> — query by its accessible role.
		render(<HabitStreakBadge streak={3} />);
		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toContain("3");
	});

	it("uses singular 'day' for a streak of 1", () => {
		render(<HabitStreakBadge streak={1} />);
		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toContain("1 day");
		// Should not say "days"
		expect(badge.getAttribute("aria-label")).not.toContain("days");
	});

	it("uses plural 'days' for streaks other than 1", () => {
		render(<HabitStreakBadge streak={5} />);
		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toContain("days");
	});
});
