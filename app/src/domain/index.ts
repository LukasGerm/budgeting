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
export { Money } from "./money";
export { formatMonthlyStatus } from "./monthly-status";
export { formatRelativeDate } from "./relative-date";
export {
	computeStreaks,
	STREAK_WINDOW_DAYS,
	type StreakPair,
	type StreakResult,
} from "./streak";
export type { Budget, Expense } from "./types";
