// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CycleComparison } from "#/domain";
import { Money } from "#/domain";
import { renderWithI18n } from "#/i18n/test-utils";
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
	it("renders the percentage and direction for a 'less' comparison — en", () => {
		renderWithI18n("en", "EUR", <VsLastDelta comparison={lessResult} />);

		const line = screen.getByText(/than last cycle so far/);
		expect(line.textContent).toContain("40%");
		expect(line.textContent).toContain("less");
		expect(line.textContent).toContain("than last cycle so far");
		// Less is the favourable case — not styled destructive.
		expect(line.className).not.toContain("text-destructive");
	});

	it("renders the 'more' comparison with destructive styling — en", () => {
		renderWithI18n("en", "EUR", <VsLastDelta comparison={moreResult} />);

		const line = screen.getByText(/than last cycle so far/);
		expect(line.textContent).toContain("50%");
		expect(line.textContent).toContain("more");
		// More than last cycle carries the destructive styling hook.
		expect(line.className).toContain("text-destructive");
	});

	it("renders an 'about the same' line for an equal comparison — en", () => {
		renderWithI18n("en", "EUR", <VsLastDelta comparison={sameResult} />);

		const line = screen.getByText(/About the same as last cycle so far/);
		expect(line.textContent).toContain("About the same as last cycle so far");
		expect(line.className).not.toContain("text-destructive");
	});

	it("renders gracefully when pct is null (zero baseline) — en", () => {
		renderWithI18n(
			"en",
			"EUR",
			<VsLastDelta comparison={zeroBaselineResult} />,
		);

		const line = screen.getByText(/than last cycle so far/);
		// No bare "null%" leaks into the copy.
		expect(line.textContent).not.toContain("null");
		expect(line.textContent).toContain("More");
		expect(line.textContent).toContain("than last cycle so far");
		expect(line.className).toContain("text-destructive");
	});

	it("renders nothing when there is no previous cycle (null)", () => {
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<VsLastDelta comparison={null} />,
		);

		// jest-dom isn't wired up here (see the other dashboard component tests),
		// so assert emptiness with plain DOM/queries instead of toBeEmptyDOMElement.
		expect(container.childElementCount).toBe(0);
		expect(container.textContent).toBe("");
		expect(screen.queryByText(/last cycle/)).toBeNull();
	});

	// German locale — guard against English words leaking into the DE UI (B1).

	it("renders German 'weniger' for a 'less' comparison — de", () => {
		renderWithI18n("de", "EUR", <VsLastDelta comparison={lessResult} />);

		const line = screen.getByText(/letzten Monat bisher/);
		expect(line.textContent).toContain("weniger");
		expect(line.textContent).not.toContain("less");
	});

	it("renders German 'mehr' for a 'more' comparison — de", () => {
		renderWithI18n("de", "EUR", <VsLastDelta comparison={moreResult} />);

		const line = screen.getByText(/letzten Monat bisher/);
		expect(line.textContent).toContain("mehr");
		expect(line.textContent).not.toContain("more");
	});

	it("renders German 'Mehr' for a zero-baseline comparison — de", () => {
		renderWithI18n(
			"de",
			"EUR",
			<VsLastDelta comparison={zeroBaselineResult} />,
		);

		const line = screen.getByText(/letzten Monat bisher/);
		expect(line.textContent).toContain("Mehr");
		// No bare English "More" should appear.
		expect(line.textContent).not.toMatch(/\bMore\b/);
	});

	it("renders German 'gleich' text for an equal comparison — de", () => {
		renderWithI18n("de", "EUR", <VsLastDelta comparison={sameResult} />);

		const line = screen.getByText(/gleich/);
		expect(line.textContent).toContain("gleich");
	});
});
