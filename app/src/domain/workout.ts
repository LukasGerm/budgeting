/**
 * Pure workout-domain math and formatting helpers.
 * No React, Prisma, or tRPC imports — unit-tested in workout.test.ts.
 *
 * Weight convention (PRD locked decision 2): weights are stored as integer
 * grams (`weightGrams`, the `amountCents` convention) and displayed as kg
 * with up to 2 decimals. The parse/format helpers below are the single
 * conversion boundary; nothing else multiplies or divides by 1000.
 */

/** The slice of a workout set the volume/1RM math needs. */
export interface SetForVolume {
	weightGrams: number | null;
	reps: number | null;
	completed: boolean;
}

/**
 * Total volume of the *completed* sets, in grams: Σ weight × reps.
 * Incomplete sets and null weight/reps contribute nothing (a bodyweight or
 * not-yet-entered set has no measurable volume).
 */
export function workoutVolumeGrams(sets: readonly SetForVolume[]): number {
	let total = 0;
	for (const set of sets) {
		if (!set.completed) continue;
		total += (set.weightGrams ?? 0) * (set.reps ?? 0);
	}
	return total;
}

/**
 * Estimated one-rep max via the Epley formula: `weight × (1 + reps / 30)`,
 * in grams (rounded to the nearest gram).
 *
 * Edge cases: 0 reps → 0 (no lift happened); 1 rep → the weight itself
 * (Epley would inflate a true single by 1/30, which is meaningless — the
 * lifted single IS the demonstrated 1RM).
 */
export function epley1RmGrams(weightGrams: number, reps: number): number {
	if (reps <= 0 || weightGrams <= 0) return 0;
	if (reps === 1) return weightGrams;
	return Math.round(weightGrams * (1 + reps / 30));
}

/** The weight/reps slice of a set the best-set selection needs. */
export interface SetWeightReps {
	weightGrams: number | null;
	reps: number | null;
}

/** The heaviest set of a session: its weight (grams) and that set's reps. */
export interface BestSet {
	weightGrams: number;
	reps: number;
}

/**
 * Pick the "best" set of a finished session: the heaviest weight, ties broken
 * by more reps. Null weight/reps coalesce to 0 (a bodyweight set has no
 * measurable weight but still competes at 0 kg). Returns null for an empty
 * list — the caller renders "—" / skips the data point.
 */
export function bestSet(sets: readonly SetWeightReps[]): BestSet | null {
	let best: BestSet | null = null;
	for (const set of sets) {
		const weightGrams = set.weightGrams ?? 0;
		const reps = set.reps ?? 0;
		if (
			best === null ||
			weightGrams > best.weightGrams ||
			(weightGrams === best.weightGrams && reps > best.reps)
		) {
			best = { weightGrams, reps };
		}
	}
	return best;
}

/**
 * The highest estimated 1RM (Epley) across all given sets, in grams.
 * Returns 0 when no set demonstrates a lift (empty list, or only sets with
 * null/zero weight or reps — `epley1RmGrams` maps those to 0).
 */
export function bestEpley1RmGrams(sets: readonly SetWeightReps[]): number {
	let best = 0;
	for (const set of sets) {
		const est = epley1RmGrams(set.weightGrams ?? 0, set.reps ?? 0);
		if (est > best) best = est;
	}
	return best;
}

/**
 * Format a second count as a clock-style duration: `m:ss` under an hour
 * (`0:42`, `12:05`), `h:mm:ss` from an hour up (`1:02:05`). Negative or
 * non-finite input clamps to `0:00`.
 */
export function formatDuration(totalSeconds: number): string {
	const safe = Number.isFinite(totalSeconds)
		? Math.max(0, Math.floor(totalSeconds))
		: 0;
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const seconds = safe % 60;
	const ss = String(seconds).padStart(2, "0");
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
	}
	return `${minutes}:${ss}`;
}

/**
 * Format integer grams as a kg display string with up to 2 decimals and no
 * trailing zeros: 82500 → "82.5", 100000 → "100", 82530 → "82.53" (grams
 * beyond 2 decimals round). `decimalSeparator` lets the UI render the
 * locale's separator ("," for German) without re-implementing the math.
 */
export function formatKg(grams: number, decimalSeparator = "."): string {
	// Round to centi-kg (2 decimals) in integer space to avoid float drift.
	const centiKg = Math.round(grams / 10);
	const whole = Math.trunc(centiKg / 100);
	const frac = Math.abs(centiKg % 100);
	if (frac === 0) return `${whole}`;
	const fracStr = String(frac).padStart(2, "0").replace(/0$/, "");
	return `${whole}${decimalSeparator}${fracStr}`;
}

/** Heaviest weight the UI accepts, mirrored by the server's zod bound. */
export const MAX_WEIGHT_KG = 2000;
/** Server-side zod bound for `weightGrams` (= MAX_WEIGHT_KG in grams). */
export const MAX_WEIGHT_GRAMS = MAX_WEIGHT_KG * 1000;
/** Most reps a single set can record, mirrored by the server's zod bound. */
export const MAX_REPS = 100;

/**
 * Parse a user-typed kg amount into integer grams.
 *
 * Accepts both "." and "," as the decimal separator ("82.5" and "82,5" —
 * German keyboards emit the comma), up to 3 fractional digits (gram
 * resolution), and an optional surrounding space. Range: 0 … MAX_WEIGHT_KG.
 *
 * Returns:
 *  - integer grams for a valid amount,
 *  - `null` for an empty string (the user cleared the field),
 *  - `undefined` for anything unparsable or out of range (caller should
 *    keep the previous value).
 */
export function parseKgToGrams(input: string): number | null | undefined {
	const trimmed = input.trim();
	if (trimmed === "") return null;
	const normalized = trimmed.replace(",", ".");
	if (
		!/^\d+(\.\d{0,3})?$/.test(normalized) &&
		!/^\.\d{1,3}$/.test(normalized)
	) {
		return undefined;
	}
	const kg = Number(normalized);
	if (!Number.isFinite(kg) || kg < 0 || kg > MAX_WEIGHT_KG) return undefined;
	return Math.round(kg * 1000);
}

/**
 * Parse a user-typed rep count into an integer.
 *
 * Returns:
 *  - the integer for a valid count (0 … MAX_REPS),
 *  - `null` for an empty string (cleared field),
 *  - `undefined` for anything unparsable or out of range.
 */
export function parseReps(input: string): number | null | undefined {
	const trimmed = input.trim();
	if (trimmed === "") return null;
	if (!/^\d+$/.test(trimmed)) return undefined;
	const reps = Number(trimmed);
	if (reps > MAX_REPS) return undefined;
	return reps;
}
