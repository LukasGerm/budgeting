/**
 * Domain barrel — re-exports value objects, types, and calculation functions.
 * Nothing in here imports from React, Prisma, or tRPC.
 */

export {
	calculateAvailableToday,
	calculateMonthlyRemaining,
} from "./calculations";
export {
	elapsedDaysInCycle,
	getCurrentCycle,
	totalDaysInCycle,
} from "./cycle";
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
