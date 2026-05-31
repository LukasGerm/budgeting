// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EndOfCycleProjection } from "#/domain";
import { Money } from "#/domain";
import { renderWithI18n } from "#/i18n/test-utils";
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
	it("renders the under-budget caption with the formatted difference — de/EUR", () => {
		renderWithI18n("de", "EUR", <ProjectionCaption projection={underResult} />);

		// de-DE EUR: 4 217 cents → "42,17 €" (with NBSP before €).
		const line = screen.getByText(/unter Budget/);
		expect(line.textContent).toContain("unter Budget");
		expect(screen.getByText(/42,17/)).toBeTruthy();
		// Under budget is not styled destructive.
		expect(line.className).not.toContain("text-destructive");
	});

	it("renders the over-budget caption with destructive styling — de/EUR", () => {
		renderWithI18n("de", "EUR", <ProjectionCaption projection={overResult} />);

		const line = screen.getByText(/über Budget/);
		expect(line.textContent).toContain("über Budget");
		// 1 800 cents → "18,00 €" (de-DE format).
		expect(screen.getByText(/18,00/)).toBeTruthy();
		// Over budget carries the destructive styling hook.
		expect(line.className).toContain("text-destructive");
	});

	it("renders the under-budget caption in English — en/EUR", () => {
		renderWithI18n("en", "EUR", <ProjectionCaption projection={underResult} />);

		const line = screen.getByText(/under budget/);
		expect(line.textContent).toContain("On pace to finish");
		expect(line.textContent).toContain("under budget");
		expect(line.className).not.toContain("text-destructive");
	});

	it("renders nothing when the projection is suppressed", () => {
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<ProjectionCaption projection={{ suppressed: true }} />,
		);

		// jest-dom isn't wired up here (see the other dashboard component tests),
		// so assert emptiness with plain DOM/queries instead of toBeEmptyDOMElement.
		expect(container.childElementCount).toBe(0);
		expect(container.textContent).toBe("");
		expect(screen.queryByText(/budget/)).toBeNull();
	});
});
