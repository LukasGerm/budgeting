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
export { Money } from "./money";
export { formatMonthlyStatus } from "./monthly-status";
export { formatRelativeDate } from "./relative-date";
export type { Budget, Expense } from "./types";
