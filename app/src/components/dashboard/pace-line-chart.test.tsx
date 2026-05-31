// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PacePoint } from "#/domain";
import { renderWithI18n } from "#/i18n/test-utils";
import { PaceLineChart } from "./pace-line-chart";

afterEach(() => {
	document.body.innerHTML = "";
});

// The formatAxisCents tests have moved to src/i18n/format.test.ts (Module B).
// This file now only tests the PaceLineChart component render behaviour.

function points(n: number): PacePoint[] {
	// Actual climbs faster than ideal so it crosses into the over-pace band.
	return Array.from({ length: n }, (_, i) => {
		const day = i + 1;
		return { day, actualNet: day * 1_200, idealNet: day * 1_000 };
	});
}

describe("PaceLineChart", () => {
	it("renders the card title and description — en", () => {
		renderWithI18n("en", "EUR", <PaceLineChart series={points(11)} />);

		expect(screen.getByText("Pace this cycle")).toBeTruthy();
		expect(
			screen.getByText("Net spending vs. the steady daily pace"),
		).toBeTruthy();
	});

	it("renders without throwing for a representative multi-day series", () => {
		// The chart itself is gated behind a client mount effect; in jsdom the
		// effect runs but Recharts' ResponsiveContainer has no real layout, so we
		// assert on the surrounding card chrome rather than the SVG internals
		// (which are brittle / size-dependent under jsdom).
		expect(() =>
			renderWithI18n("en", "EUR", <PaceLineChart series={points(20)} />),
		).not.toThrow();
		expect(screen.getByText("Pace this cycle")).toBeTruthy();
	});

	it("shows the not-enough-data affordance for a single point — en", () => {
		renderWithI18n("en", "EUR", <PaceLineChart series={points(1)} />);

		// Title still renders; the body shows the sparse-data message instead of a
		// chart (a one-point line can't be drawn).
		expect(screen.getByText("Pace this cycle")).toBeTruthy();
		expect(
			screen.getByText("Not enough data yet — come back tomorrow."),
		).toBeTruthy();
	});

	it("does not throw on an empty series", () => {
		expect(() =>
			renderWithI18n("en", "EUR", <PaceLineChart series={[]} />),
		).not.toThrow();
		expect(screen.getByText("Pace this cycle")).toBeTruthy();
	});
});
