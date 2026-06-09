/**
 * Domain barrel — re-exports value objects, types, and calculation functions.
 * Nothing in here imports from React, Prisma, or tRPC.
 */

export {
	calculateAvailableToday,
	calculateMonthlyRemaining,
} from "./calculations";
export type { Cycle } from "./cycle";
export {
	elapsedDaysInCycle,
	getCurrentCycle,
	totalDaysInCycle,
} from "./cycle";
export { getRecentCycles } from "./cycle-history";
export {
	biggestSpends,
	type CycleComparison,
	type CycleSpendSummary,
	type CycleTotal,
	compareToLastCycle,
	cumulativePaceSeries,
	cycleSpendSummary,
	cycleTotals,
	type DailyBucket,
	type DailySpendBuckets,
	dailySpendBuckets,
	type EndOfCycleProjection,
	type PacePoint,
	projectEndOfCycle,
} from "./dashboard";
export type { AdjustmentDirection, EntryKind } from "./entry";
export {
	adjustmentAmountCents,
	adjustmentDirection,
	sumNet,
	sumSpends,
} from "./entry";
export {
	buildHeatmap,
	currentStreak,
	dayKey,
	HABIT_COLOR_PALETTE,
	type HeatmapCell,
	type HeatmapCellState,
	pickHabitColor,
} from "./habit";
export { Money } from "./money";
export { getMonthlyStatus, type MonthlyStatus } from "./monthly-status";
export {
	calendarDaysAgo,
	getRelativeDate,
	type RelativeDate,
} from "./relative-date";
export { moveItem } from "./routine";
export {
	computeStreaks,
	STREAK_WINDOW_DAYS,
	type StreakPair,
	type StreakResult,
} from "./streak";
export type { Budget, Expense } from "./types";
export {
	type BestSet,
	bestEpley1RmGrams,
	bestSet,
	epley1RmGrams,
	formatDuration,
	formatKg,
	MAX_REPS,
	MAX_WEIGHT_GRAMS,
	MAX_WEIGHT_KG,
	parseKgToGrams,
	parseReps,
	type SetForVolume,
	type SetWeightReps,
	workoutVolumeGrams,
} from "./workout";
