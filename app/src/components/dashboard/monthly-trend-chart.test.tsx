// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type CycleTotal, getRecentCycles, Money } from "#/domain";
import { MonthlyTrendChart } from "./monthly-trend-chart";

afterEach(() => {
	document.body.innerHTML = "";
});

// Anchor 1, six calendar-month cycles back from March 2025 (newest → oldest).
const cycles = getRecentCycles(new Date(2025, 2, 11, 12), 1, 6);
const monthly = Money.fromCents(30_000);

/** Build totals where the first `withData` cycles each have entries. */
function totals(withData: number): CycleTotal[] {
	return cycles.map((cycle, i) => ({
		cycle,
		netCents: i < withData ? 12_000 : 0,
		entryCount: i < withData ? 1 : 0,
	}));
}

describe("MonthlyTrendChart", () => {
	it("renders the card title", () => {
		render(<MonthlyTrendChart totals={totals(3)} monthlyAmount={monthly} />);

		expect(screen.getByText("Monthly totals")).toBeTruthy();
	});

	it("shows the placeholder when fewer than 2 cycles have data", () => {
		// Only one cycle has any entries → no trend yet.
		render(<MonthlyTrendChart totals={totals(1)} monthlyAmount={monthly} />);

		expect(screen.getByText("Monthly totals")).toBeTruthy();
		expect(
			screen.getByText(/Your monthly trend will appear once you've completed/i),
		).toBeTruthy();
	});

	it("treats a net-zero cycle with entries as having data (entryCount, not net)", () => {
		// Two cycles each net to 0 but DO have entries (e.g. spend cancelled by a
		// top-up). The placeholder must NOT show — they count as data.
		const netZeroWithData: CycleTotal[] = cycles.map((cycle, i) => ({
			cycle,
			netCents: 0,
			entryCount: i < 2 ? 2 : 0,
		}));
		render(
			<MonthlyTrendChart totals={netZeroWithData} monthlyAmount={monthly} />,
		);

		expect(
			screen.queryByText(
				/Your monthly trend will appear once you've completed/i,
			),
		).toBeNull();
	});

	it("renders the chart card without throwing when ≥2 cycles have data", () => {
		// Recharts has no real layout under jsdom, so assert on the card chrome
		// rather than SVG internals (brittle / size-dependent).
		expect(() =>
			render(<MonthlyTrendChart totals={totals(4)} monthlyAmount={monthly} />),
		).not.toThrow();
		expect(screen.getByText("Monthly totals")).toBeTruthy();
		// The placeholder is gone once there's enough data.
		expect(
			screen.queryByText(
				/Your monthly trend will appear once you've completed/i,
			),
		).toBeNull();
	});
});
