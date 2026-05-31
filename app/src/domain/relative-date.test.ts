import { describe, expect, it } from "vitest";
import { getRelativeDate } from "./relative-date";

/** Helper: a local-time Date built from y/m/d (month is 1-indexed for tests). */
function local(y: number, m: number, d: number, hh = 12, mm = 0): Date {
	return new Date(y, m - 1, d, hh, mm, 0, 0);
}

describe("getRelativeDate", () => {
	// A fixed `now` so the helper is exercised exactly as the app uses it:
	// `getRelativeDate(date, now)`.
	const now = () => local(2025, 3, 20, 14, 30);

	it("returns { kind: 'today' } for the same calendar day", () => {
		expect(getRelativeDate(local(2025, 3, 20, 9, 0), now())).toEqual({
			kind: "today",
		});
	});

	it("returns { kind: 'today' } for a time later the same day", () => {
		expect(getRelativeDate(local(2025, 3, 20, 23, 59), now())).toEqual({
			kind: "today",
		});
	});

	it("returns { kind: 'today' } just after local midnight", () => {
		expect(getRelativeDate(local(2025, 3, 20, 0, 1), now())).toEqual({
			kind: "today",
		});
	});

	it("returns { kind: 'yesterday' } for the prior calendar day", () => {
		expect(getRelativeDate(local(2025, 3, 19, 18, 0), now())).toEqual({
			kind: "yesterday",
		});
	});

	it("edge: exactly one calendar day earlier is 'yesterday', not 'today'", () => {
		// Same wall-clock time, one day before → still 'yesterday'.
		expect(getRelativeDate(local(2025, 3, 19, 14, 30), now())).toEqual({
			kind: "yesterday",
		});
	});

	it("returns { kind: 'days_ago', days: 3 } for three calendar days earlier", () => {
		expect(getRelativeDate(local(2025, 3, 17, 12, 0), now())).toEqual({
			kind: "days_ago",
			days: 3,
		});
	});

	it("counts by calendar day, not 24h windows (late→early crossing one midnight)", () => {
		// Yesterday 23:00 vs today 00:30 (now) is < 24h apart but is one
		// calendar day → 'yesterday'.
		const early = local(2025, 3, 20, 0, 30);
		expect(getRelativeDate(local(2025, 3, 19, 23, 0), early)).toEqual({
			kind: "yesterday",
		});
	});

	it("treats a future date as 'today' (defensive; expenses never future-dated)", () => {
		expect(getRelativeDate(local(2025, 3, 21, 9, 0), now())).toEqual({
			kind: "today",
		});
	});
});
