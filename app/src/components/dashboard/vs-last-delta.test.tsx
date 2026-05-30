// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CycleComparison } from "#/domain";
import { Money } from "#/domain";
import { VsLastDelta } from "./vs-last-delta";

afterEach(() => {
	document.body.innerHTML = "";
});

const lessResult: CycleComparison = {
	currentNet: Money.fromCents(6_000),
	lastNetAtSameDay: Money.fromCents(10_000),
	pct: 40,
	direction: "less",
};

const moreResult: CycleComparison = {
	currentNet: Money.fromCents(12_000),
	lastNetAtSameDay: Money.fromCents(8_000),
	pct: 50,
	direction: "more",
};

const sameResult: CycleComparison = {
	currentNet: Money.fromCents(5_000),
	lastNetAtSameDay: Money.fromCents(5_000),
	pct: 0,
	direction: "same",
};

const zeroBaselineResult: CycleComparison = {
	currentNet: Money.fromCents(3_000),
	lastNetAtSameDay: Money.fromCents(0),
	pct: null,
	direction: "more",
};

describe("VsLastDelta", () => {
	it("renders the percentage and direction for a 'less' comparison", () => {
		render(<VsLastDelta comparison={lessResult} />);

		const line = screen.getByText(/than last cycle so far/);
		expect(line.textContent).toContain("40%");
		expect(line.textContent).toContain("less");
		expect(line.textContent).toContain("than last cycle so far");
		// Less is the favourable case — not styled destructive.
		expect(line.className).not.toContain("text-destructive");
	});

	it("renders the 'more' comparison with destructive styling", () => {
		render(<VsLastDelta comparison={moreResult} />);

		const line = screen.getByText(/than last cycle so far/);
		expect(line.textContent).toContain("50%");
		expect(line.textContent).toContain("more");
		// More than last cycle carries the destructive styling hook.
		expect(line.className).toContain("text-destructive");
	});

	it("renders an 'about the same' line for an equal comparison", () => {
		render(<VsLastDelta comparison={sameResult} />);

		const line = screen.getByText(/About the same as last cycle so far/);
		expect(line.textContent).toContain("About the same as last cycle so far");
		expect(line.className).not.toContain("text-destructive");
	});

	it("renders gracefully when pct is null (zero baseline)", () => {
		render(<VsLastDelta comparison={zeroBaselineResult} />);

		const line = screen.getByText(/than last cycle so far/);
		// No bare "null%" leaks into the copy.
		expect(line.textContent).not.toContain("null");
		expect(line.textContent).toContain("More");
		expect(line.textContent).toContain("than last cycle so far");
		expect(line.className).toContain("text-destructive");
	});

	it("renders nothing when there is no previous cycle (null)", () => {
		const { container } = render(<VsLastDelta comparison={null} />);

		// jest-dom isn't wired up here (see the other dashboard component tests),
		// so assert emptiness with plain DOM/queries instead of toBeEmptyDOMElement.
		expect(container.childElementCount).toBe(0);
		expect(container.textContent).toBe("");
		expect(screen.queryByText(/last cycle/)).toBeNull();
	});
});
