// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithI18n } from "#/i18n/test-utils";
import { HabitStreakBadge } from "./habit-streak-badge";

afterEach(() => {
	document.body.innerHTML = "";
});

describe("HabitStreakBadge", () => {
	it("renders the streak count", () => {
		renderWithI18n("en", "EUR", <HabitStreakBadge streak={7} />);
		expect(screen.getByText("7")).toBeTruthy();
	});

	it("renders 0 when streak is 0 (does not hide zero)", () => {
		renderWithI18n("en", "EUR", <HabitStreakBadge streak={0} />);
		expect(screen.getByText("0")).toBeTruthy();
	});

	it("renders a flame icon (aria-hidden, not in accessible name)", () => {
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<HabitStreakBadge streak={5} />,
		);
		// The svg flame icon is aria-hidden; we find it by tagName.
		const svgEl = container.querySelector("svg[aria-hidden='true']");
		expect(svgEl).toBeTruthy();
	});

	it("has a meaningful aria-label describing the streak", () => {
		// The badge renders as <output> — query by its accessible role.
		renderWithI18n("en", "EUR", <HabitStreakBadge streak={3} />);
		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toContain("3");
	});

	it("uses singular 'day' for a streak of 1 — en", () => {
		renderWithI18n("en", "EUR", <HabitStreakBadge streak={1} />);
		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toBe("Current streak: 1 day");
	});

	it("uses plural 'days' for streaks other than 1 — en", () => {
		renderWithI18n("en", "EUR", <HabitStreakBadge streak={5} />);
		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toBe("Current streak: 5 days");
	});

	it("uses singular 'Tag' for a streak of 1 — de", () => {
		renderWithI18n("de", "EUR", <HabitStreakBadge streak={1} />);
		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toBe("Aktueller Streak: 1 Tag");
	});

	it("uses plural 'Tage' for streaks other than 1 — de", () => {
		renderWithI18n("de", "EUR", <HabitStreakBadge streak={5} />);
		const badge = screen.getByRole("status");
		expect(badge.getAttribute("aria-label")).toBe("Aktueller Streak: 5 Tage");
	});
});
