// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type Expense, Money } from "#/domain";
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
	it("renders one row per spend with its formatted amount and note", () => {
		const spends = [
			spend(8_000, "Groceries", "a"),
			spend(5_000, "Dinner", "b"),
			spend(3_000, null, "c"),
		];
		const { container } = render(<BiggestSpends spends={spends} />);

		expect(screen.getByText("Biggest spends")).toBeTruthy();

		// One <li> per spend.
		expect(container.querySelectorAll("li")).toHaveLength(3);

		// Money.format() is de-DE EUR: 8 000 cents → "80,00 €".
		expect(screen.getByText("80,00 €")).toBeTruthy();
		expect(screen.getByText("50,00 €")).toBeTruthy();
		expect(screen.getByText("30,00 €")).toBeTruthy();

		// Notes render, and a null note falls back to "No note".
		expect(screen.getByText("Groceries")).toBeTruthy();
		expect(screen.getByText("Dinner")).toBeTruthy();
		expect(screen.getByText("No note")).toBeTruthy();
	});

	it("renders nothing when the list is empty", () => {
		const { container } = render(<BiggestSpends spends={[]} />);

		expect(container.innerHTML).toBe("");
		expect(screen.queryByText("Biggest spends")).toBeNull();
	});
});
