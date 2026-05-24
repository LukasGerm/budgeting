/**
 * Domain types — plain TS interfaces, no Prisma types leak in here.
 *
 * Hooks convert between wire payloads (integer cents from tRPC) and these at
 * the component boundary. The domain only ever sees these.
 */

import type { Money } from "./money";

export interface Budget {
	readonly monthlyAmount: Money;
	readonly anchorDay: number; // 1–31
}

export interface Expense {
	readonly id: string;
	readonly amount: Money;
	readonly note: string | null;
	readonly createdAt: Date;
}
