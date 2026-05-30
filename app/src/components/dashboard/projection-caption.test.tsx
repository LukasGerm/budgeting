// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EndOfCycleProjection } from "#/domain";
import { Money } from "#/domain";
import { ProjectionCaption } from "./projection-caption";

afterEach(() => {
	document.body.innerHTML = "";
});

const underResult: EndOfCycleProjection = {
	suppressed: false,
	projectedNet: Money.fromCents(14_090),
	overUnder: "under",
	difference: Money.fromCents(4_217),
};

const overResult: EndOfCycleProjection = {
	suppressed: false,
	projectedNet: Money.fromCents(42_272),
	overUnder: "over",
	difference: Money.fromCents(1_800),
};

describe("ProjectionCaption", () => {
	it("renders the under-budget caption with the formatted difference", () => {
		render(<ProjectionCaption projection={underResult} />);

		// Money.format() is de-DE EUR: 4 217 cents → "42,17 €".
		const line = screen.getByText(/under budget/);
		expect(line.textContent).toContain("On pace to finish");
		expect(line.textContent).toContain("under budget");
		expect(screen.getByText("42,17 €")).toBeTruthy();
		// Under budget is not styled destructive.
		expect(line.className).not.toContain("text-destructive");
	});

	it("renders the over-budget caption with destructive styling", () => {
		render(<ProjectionCaption projection={overResult} />);

		const line = screen.getByText(/over budget/);
		expect(line.textContent).toContain("On pace to finish");
		expect(line.textContent).toContain("over budget");
		// 1 800 cents → "18,00 €".
		expect(screen.getByText("18,00 €")).toBeTruthy();
		// Over budget carries the destructive styling hook.
		expect(line.className).toContain("text-destructive");
	});

	it("renders nothing when the projection is suppressed", () => {
		const { container } = render(
			<ProjectionCaption projection={{ suppressed: true }} />,
		);

		// jest-dom isn't wired up here (see the other dashboard component tests),
		// so assert emptiness with plain DOM/queries instead of toBeEmptyDOMElement.
		expect(container.childElementCount).toBe(0);
		expect(container.textContent).toBe("");
		expect(screen.queryByText(/budget/)).toBeNull();
	});
});
