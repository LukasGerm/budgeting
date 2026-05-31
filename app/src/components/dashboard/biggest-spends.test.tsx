// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type Expense, Money } from "#/domain";
import { renderWithI18n } from "#/i18n/test-utils";
import { BiggestSpends } from "./biggest-spends";

afterEach(() => {
	document.body.innerHTML = "";
});

function spend(amountCents: number, note: string | null, id: string): Expense {
	return {
		id,
		kind: "spend",
		amount: Money.fromCents(amountCents),
		note,
		createdAt: new Date(2025, 2, 11, 12),
	};
}

describe("BiggestSpends", () => {
	it("renders one row per spend with its formatted amount and note — de/EUR", () => {
		const spends = [
			spend(8_000, "Groceries", "a"),
			spend(5_000, "Dinner", "b"),
			spend(3_000, null, "c"),
		];
		const { container } = renderWithI18n(
			"de",
			"EUR",
			<BiggestSpends spends={spends} />,
		);

		// DE: "Bigger spends" → "Größte Ausgaben"
		expect(screen.getByText("Größte Ausgaben")).toBeTruthy();

		// One <li> per spend.
		expect(container.querySelectorAll("li")).toHaveLength(3);

		// de-DE EUR: 8 000 cents → "80,00 €" (with NBSP).
		expect(screen.getByText(/80,00/)).toBeTruthy();
		expect(screen.getByText(/50,00/)).toBeTruthy();
		expect(screen.getByText(/30,00/)).toBeTruthy();

		// Notes render, and a null note falls back to the locale's "No note" equivalent.
		// DE: "No note" → "Keine Notiz"
		expect(screen.getByText("Groceries")).toBeTruthy();
		expect(screen.getByText("Dinner")).toBeTruthy();
		expect(screen.getByText("Keine Notiz")).toBeTruthy();
	});

	it("renders the card title in German — de", () => {
		const spends = [spend(8_000, "Test", "a")];
		renderWithI18n("de", "EUR", <BiggestSpends spends={spends} />);
		// German translation from catalog
		expect(screen.getByText("Größte Ausgaben")).toBeTruthy();
	});

	it("renders nothing when the list is empty", () => {
		const { container } = renderWithI18n(
			"en",
			"EUR",
			<BiggestSpends spends={[]} />,
		);

		expect(container.innerHTML).toBe("");
		expect(screen.queryByText("Biggest spends")).toBeNull();
	});
});
