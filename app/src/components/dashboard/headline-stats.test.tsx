// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CycleSpendSummary } from "#/domain";
import { Money } from "#/domain";
import { renderWithI18n } from "#/i18n/test-utils";
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
	it("renders formatted total, average and days left — de/EUR (de-DE format)", () => {
		renderWithI18n("de", "EUR", <HeadlineStats summary={summary()} />);

		// de-DE EUR: 12 345 cents → "123,45 €" (with NBSP before €)
		expect(screen.getByText(/123,45/)).toBeTruthy();
		expect(screen.getByText(/11,22/)).toBeTruthy();
		// "20 Tage" in German (or similar plural form from catalog)
		expect(screen.getByText(/20/)).toBeTruthy();

		// German label translations (from DE catalog)
		expect(screen.getByText("Diese Periode ausgegeben")).toBeTruthy();
	});

	it("renders formatted total and average — en/EUR (en-GB format)", () => {
		renderWithI18n("en", "EUR", <HeadlineStats summary={summary()} />);

		// en-GB EUR: 12 345 cents → "€123.45"
		expect(screen.getByText(/123\.45/)).toBeTruthy();
		expect(screen.getByText(/11\.22/)).toBeTruthy();
	});

	it("renders English stat labels — en", () => {
		renderWithI18n("en", "EUR", <HeadlineStats summary={summary()} />);
		expect(screen.getByText("Spent this cycle")).toBeTruthy();
		expect(screen.getByText("Average / day")).toBeTruthy();
		expect(screen.getByText("Days left")).toBeTruthy();
	});

	it("uses the singular unit when one day is left — en", () => {
		renderWithI18n(
			"en",
			"EUR",
			<HeadlineStats summary={summary({ daysLeft: 1 })} />,
		);
		expect(screen.getByText("1 day")).toBeTruthy();
	});

	it("uses the plural unit for multiple days left — en", () => {
		renderWithI18n(
			"en",
			"EUR",
			<HeadlineStats summary={summary({ daysLeft: 20 })} />,
		);
		expect(screen.getByText("20 days")).toBeTruthy();
	});
});
