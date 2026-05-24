import { describe, expect, it } from "vitest";
import { formatRelativeDate } from "./relative-date";

/** Helper: a local-time Date built from y/m/d (month is 1-indexed for tests). */
function local(y: number, m: number, d: number, hh = 12, mm = 0): Date {
	return new Date(y, m - 1, d, hh, mm, 0, 0);
}

describe("formatRelativeDate", () => {
	// A fixed `now` so the helper is exercised exactly as the app uses it:
	// `formatRelativeDate(date, now)`.
	const now = () => local(2025, 3, 20, 14, 30);

	it("returns 'today' for the same calendar day", () => {
		expect(formatRelativeDate(local(2025, 3, 20, 9, 0), now())).toBe("today");
	});

	it("returns 'today' for a time later the same day", () => {
		expect(formatRelativeDate(local(2025, 3, 20, 23, 59), now())).toBe("today");
	});

	it("returns 'today' just after local midnight", () => {
		expect(formatRelativeDate(local(2025, 3, 20, 0, 1), now())).toBe("today");
	});

	it("returns 'yesterday' for the prior calendar day", () => {
		expect(formatRelativeDate(local(2025, 3, 19, 18, 0), now())).toBe(
			"yesterday",
		);
	});

	it("edge: exactly one calendar day earlier is 'yesterday', not 'today'", () => {
		// Same wall-clock time, one day before → still 'yesterday'.
		expect(formatRelativeDate(local(2025, 3, 19, 14, 30), now())).toBe(
			"yesterday",
		);
	});

	it("returns '3 days ago' for three calendar days earlier", () => {
		expect(formatRelativeDate(local(2025, 3, 17, 12, 0), now())).toBe(
			"3 days ago",
		);
	});

	it("counts by calendar day, not 24h windows (late→early crossing one midnight)", () => {
		// Yesterday 23:00 vs today 00:30 (now) is < 24h apart but is one
		// calendar day → 'yesterday'.
		const early = local(2025, 3, 20, 0, 30);
		expect(formatRelativeDate(local(2025, 3, 19, 23, 0), early)).toBe(
			"yesterday",
		);
	});

	it("treats a future date as 'today' (defensive; expenses never future-dated)", () => {
		expect(formatRelativeDate(local(2025, 3, 21, 9, 0), now())).toBe("today");
	});
});
