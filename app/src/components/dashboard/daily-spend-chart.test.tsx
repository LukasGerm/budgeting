// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DailyBucket } from "#/domain";
import { renderWithI18n } from "#/i18n/test-utils";
import { DailySpendChart } from "./daily-spend-chart";

afterEach(() => {
	document.body.innerHTML = "";
});

function buckets(): DailyBucket[] {
	// A representative mix: an under-allowance day, an over day, and a zero day.
	return [
		{ day: 1, spentCents: 500, over: false },
		{ day: 2, spentCents: 1_500, over: true },
		{ day: 3, spentCents: 0, over: false },
	];
}

describe("DailySpendChart", () => {
	it("renders the card title — en", () => {
		renderWithI18n("en", "EUR", <DailySpendChart buckets={buckets()} />);

		expect(screen.getByText("Daily spend")).toBeTruthy();
	});

	it("surfaces the spends-only vs. net-pace caption — en", () => {
		renderWithI18n("en", "EUR", <DailySpendChart buckets={buckets()} />);

		// The acceptance criterion: the discrepancy with the net pace line is
		// spelled out so an adjustment-day mismatch isn't confusing.
		expect(
			screen.getByText(
				/Spends only — adjustments aren't shown here, so this won't match the net pace line on adjustment days\./i,
			),
		).toBeTruthy();
	});

	it("renders representative over/under buckets without throwing", () => {
		// The chart is gated behind a client mount; under jsdom Recharts has no
		// real layout, so we assert on the card chrome rather than the SVG
		// internals (brittle / size-dependent under jsdom).
		expect(() =>
			renderWithI18n("en", "EUR", <DailySpendChart buckets={buckets()} />),
		).not.toThrow();
		expect(screen.getByText("Daily spend")).toBeTruthy();
	});

	it("shows the empty affordance when there are no buckets — en", () => {
		renderWithI18n("en", "EUR", <DailySpendChart buckets={[]} />);

		expect(screen.getByText("Daily spend")).toBeTruthy();
		expect(screen.getByText(/No spending yet this cycle/i)).toBeTruthy();
	});
});
