// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PacePoint } from "#/domain";
import { formatAxisCents, PaceLineChart } from "./pace-line-chart";

afterEach(() => {
	document.body.innerHTML = "";
});

describe("formatAxisCents", () => {
	it("renders zero as €0", () => {
		expect(formatAxisCents(0)).toBe("€0");
	});

	it("renders values under €1 000 as whole euros", () => {
		expect(formatAxisCents(50000)).toBe("€500"); // €500
		expect(formatAxisCents(99900)).toBe("€999"); // €999
		expect(formatAxisCents(100)).toBe("€1"); // €1
		expect(formatAxisCents(150)).toBe("€1"); // €1.50 truncates to €1, not €2
	});

	it("renders €1 000–€9 999 with one decimal and k (comma separator)", () => {
		expect(formatAxisCents(100000)).toBe("€1,0k"); // €1 000 — first k value
		expect(formatAxisCents(123400)).toBe("€1,2k"); // €1 234
		expect(formatAxisCents(200000)).toBe("€2,0k"); // €2 000
		expect(formatAxisCents(999900)).toBe("€10,0k"); // €9 999 — rounds up to 10,0k
	});

	it("renders €10 000+ as whole thousands with k, no decimal", () => {
		expect(formatAxisCents(1000000)).toBe("€10k"); // €10 000
		expect(formatAxisCents(1234500)).toBe("€12k"); // €12 345
	});

	it("handles negatives symmetrically", () => {
		expect(formatAxisCents(-50000)).toBe("-€500");
		expect(formatAxisCents(-123400)).toBe("-€1,2k");
		expect(formatAxisCents(-1234500)).toBe("-€12k");
	});
});

function points(n: number): PacePoint[] {
	// Actual climbs faster than ideal so it crosses into the over-pace band.
	return Array.from({ length: n }, (_, i) => {
		const day = i + 1;
		return { day, actualNet: day * 1_200, idealNet: day * 1_000 };
	});
}

describe("PaceLineChart", () => {
	it("renders the card title and description", () => {
		render(<PaceLineChart series={points(11)} />);

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
		expect(() => render(<PaceLineChart series={points(20)} />)).not.toThrow();
		expect(screen.getByText("Pace this cycle")).toBeTruthy();
	});

	it("shows the not-enough-data affordance for a single point", () => {
		render(<PaceLineChart series={points(1)} />);

		// Title still renders; the body shows the sparse-data message instead of a
		// chart (a one-point line can't be drawn).
		expect(screen.getByText("Pace this cycle")).toBeTruthy();
		expect(
			screen.getByText("Not enough data yet — come back tomorrow."),
		).toBeTruthy();
	});

	it("does not throw on an empty series", () => {
		expect(() => render(<PaceLineChart series={[]} />)).not.toThrow();
		expect(screen.getByText("Pace this cycle")).toBeTruthy();
	});
});
