import { describe, expect, it } from "vitest";
import {
	bestEpley1RmGrams,
	bestSet,
	epley1RmGrams,
	formatDuration,
	formatKg,
	parseKgToGrams,
	parseReps,
	workoutVolumeGrams,
} from "./workout";

describe("workoutVolumeGrams", () => {
	it("sums weight × reps of completed sets", () => {
		expect(
			workoutVolumeGrams([
				{ weightGrams: 80_000, reps: 8, completed: true },
				{ weightGrams: 100_000, reps: 5, completed: true },
			]),
		).toBe(80_000 * 8 + 100_000 * 5);
	});

	it("ignores incomplete sets", () => {
		expect(
			workoutVolumeGrams([
				{ weightGrams: 80_000, reps: 8, completed: false },
				{ weightGrams: 60_000, reps: 10, completed: true },
			]),
		).toBe(600_000);
	});

	it("treats null weight or reps as zero volume", () => {
		expect(
			workoutVolumeGrams([
				{ weightGrams: null, reps: 12, completed: true },
				{ weightGrams: 50_000, reps: null, completed: true },
			]),
		).toBe(0);
	});

	it("returns 0 for an empty list", () => {
		expect(workoutVolumeGrams([])).toBe(0);
	});
});

describe("bestSet", () => {
	it("picks the heaviest set", () => {
		expect(
			bestSet([
				{ weightGrams: 80_000, reps: 8 },
				{ weightGrams: 100_000, reps: 3 },
				{ weightGrams: 90_000, reps: 6 },
			]),
		).toEqual({ weightGrams: 100_000, reps: 3 });
	});

	it("breaks weight ties by more reps", () => {
		expect(
			bestSet([
				{ weightGrams: 100_000, reps: 5 },
				{ weightGrams: 100_000, reps: 8 },
				{ weightGrams: 100_000, reps: 6 },
			]),
		).toEqual({ weightGrams: 100_000, reps: 8 });
	});

	it("keeps the first set on a full tie", () => {
		expect(
			bestSet([
				{ weightGrams: 100_000, reps: 5 },
				{ weightGrams: 100_000, reps: 5 },
			]),
		).toEqual({ weightGrams: 100_000, reps: 5 });
	});

	it("coalesces null weight/reps to 0 (bodyweight sets compete at 0 kg)", () => {
		expect(
			bestSet([
				{ weightGrams: null, reps: 12 },
				{ weightGrams: null, reps: 15 },
			]),
		).toEqual({ weightGrams: 0, reps: 15 });
	});

	it("returns null for an empty list", () => {
		expect(bestSet([])).toBeNull();
	});
});

describe("bestEpley1RmGrams", () => {
	it("returns the max estimated 1RM across sets", () => {
		// 100 kg × 10 → 133.333 kg; 120 kg × 3 → 132 kg; 130 kg × 1 → 130 kg.
		expect(
			bestEpley1RmGrams([
				{ weightGrams: 100_000, reps: 10 },
				{ weightGrams: 120_000, reps: 3 },
				{ weightGrams: 130_000, reps: 1 },
			]),
		).toBe(133_333);
	});

	it("returns 0 when no set demonstrates a lift", () => {
		expect(bestEpley1RmGrams([])).toBe(0);
		expect(
			bestEpley1RmGrams([
				{ weightGrams: null, reps: 10 },
				{ weightGrams: 100_000, reps: null },
			]),
		).toBe(0);
	});
});

describe("epley1RmGrams", () => {
	it("applies weight × (1 + reps/30)", () => {
		// 100 kg × 10 reps → 100 × (1 + 10/30) = 133.333… kg
		expect(epley1RmGrams(100_000, 10)).toBe(133_333);
	});

	it("returns the weight itself for a single rep", () => {
		expect(epley1RmGrams(140_000, 1)).toBe(140_000);
	});

	it("returns 0 for zero or negative reps", () => {
		expect(epley1RmGrams(100_000, 0)).toBe(0);
		expect(epley1RmGrams(100_000, -3)).toBe(0);
	});

	it("returns 0 for zero weight", () => {
		expect(epley1RmGrams(0, 8)).toBe(0);
	});
});

describe("formatDuration", () => {
	it("formats under a minute as m:ss", () => {
		expect(formatDuration(0)).toBe("0:00");
		expect(formatDuration(42)).toBe("0:42");
	});

	it("formats minutes as m:ss with padded seconds", () => {
		expect(formatDuration(65)).toBe("1:05");
		expect(formatDuration(12 * 60 + 5)).toBe("12:05");
	});

	it("formats an hour and up as h:mm:ss", () => {
		expect(formatDuration(3600)).toBe("1:00:00");
		expect(formatDuration(3725)).toBe("1:02:05");
	});

	it("clamps negative and non-finite input to 0:00", () => {
		expect(formatDuration(-5)).toBe("0:00");
		expect(formatDuration(Number.NaN)).toBe("0:00");
	});

	it("floors fractional seconds", () => {
		expect(formatDuration(59.9)).toBe("0:59");
	});
});

describe("formatKg", () => {
	it("drops trailing zeros", () => {
		expect(formatKg(82_500)).toBe("82.5");
		expect(formatKg(100_000)).toBe("100");
	});

	it("keeps two decimals when needed", () => {
		expect(formatKg(82_530)).toBe("82.53");
		expect(formatKg(1_250)).toBe("1.25");
	});

	it("rounds sub-centi-kg grams", () => {
		expect(formatKg(82_534)).toBe("82.53");
		expect(formatKg(82_535)).toBe("82.54");
	});

	it("formats zero as 0", () => {
		expect(formatKg(0)).toBe("0");
	});

	it("uses the given decimal separator", () => {
		expect(formatKg(82_500, ",")).toBe("82,5");
	});
});

describe("parseKgToGrams", () => {
	it("parses dot decimals", () => {
		expect(parseKgToGrams("82.5")).toBe(82_500);
		expect(parseKgToGrams("100")).toBe(100_000);
		expect(parseKgToGrams("0.25")).toBe(250);
	});

	it("parses comma decimals (German keyboards)", () => {
		expect(parseKgToGrams("82,5")).toBe(82_500);
	});

	it("parses a leading-dot fraction", () => {
		expect(parseKgToGrams(".5")).toBe(500);
	});

	it("trims surrounding whitespace", () => {
		expect(parseKgToGrams(" 60 ")).toBe(60_000);
	});

	it("returns null for an empty string (cleared field)", () => {
		expect(parseKgToGrams("")).toBeNull();
		expect(parseKgToGrams("   ")).toBeNull();
	});

	it("returns undefined for garbage", () => {
		expect(parseKgToGrams("abc")).toBeUndefined();
		expect(parseKgToGrams("1.2.3")).toBeUndefined();
		expect(parseKgToGrams("-5")).toBeUndefined();
		expect(parseKgToGrams("1,2,3")).toBeUndefined();
	});

	it("returns undefined above the 2000 kg cap", () => {
		expect(parseKgToGrams("2000")).toBe(2_000_000);
		expect(parseKgToGrams("2000.5")).toBeUndefined();
	});

	it("rounds beyond gram resolution away", () => {
		// 4 fractional digits are rejected (gram resolution is 3).
		expect(parseKgToGrams("1.2345")).toBeUndefined();
	});
});

describe("parseReps", () => {
	it("parses plain integers", () => {
		expect(parseReps("8")).toBe(8);
		expect(parseReps("0")).toBe(0);
		expect(parseReps("100")).toBe(100);
	});

	it("returns null for an empty string", () => {
		expect(parseReps("")).toBeNull();
		expect(parseReps("  ")).toBeNull();
	});

	it("returns undefined for non-integers and out-of-range", () => {
		expect(parseReps("8.5")).toBeUndefined();
		expect(parseReps("-2")).toBeUndefined();
		expect(parseReps("101")).toBeUndefined();
		expect(parseReps("abc")).toBeUndefined();
	});
});
