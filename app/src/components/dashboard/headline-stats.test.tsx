// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CycleSpendSummary } from "#/domain";
import { Money } from "#/domain";
import { HeadlineStats } from "./headline-stats";

afterEach(() => {
	document.body.innerHTML = "";
});

function summary(
	overrides: Partial<{
		totalSpentCents: number;
		avgPerDayCents: number;
		daysLeft: number;
	}> = {},
): CycleSpendSummary {
	return {
		totalSpent: Money.fromCents(overrides.totalSpentCents ?? 12_345),
		avgPerDay: Money.fromCents(overrides.avgPerDayCents ?? 1_122),
		daysLeft: overrides.daysLeft ?? 20,
	};
}

describe("HeadlineStats", () => {
	it("renders the formatted total, average and days left", () => {
		render(<HeadlineStats summary={summary()} />);

		// Money.format() is de-DE EUR: 12 345 cents → "123,45 €".
		expect(screen.getByText("123,45 €")).toBeTruthy();
		expect(screen.getByText("11,22 €")).toBeTruthy();
		expect(screen.getByText("20 days")).toBeTruthy();

		expect(screen.getByText("Spent this cycle")).toBeTruthy();
		expect(screen.getByText("Average / day")).toBeTruthy();
		expect(screen.getByText("Days left")).toBeTruthy();
	});

	it("uses the singular unit when one day is left", () => {
		render(<HeadlineStats summary={summary({ daysLeft: 1 })} />);
		expect(screen.getByText("1 day")).toBeTruthy();
	});
});
