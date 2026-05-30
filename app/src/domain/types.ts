/**
 * Domain types — plain TS interfaces, no Prisma types leak in here.
 *
 * Hooks convert between wire payloads (integer cents from tRPC) and these at
 * the component boundary. The domain only ever sees these.
 */

import type { EntryKind } from "./entry";
import type { Money } from "./money";

export interface Budget {
	readonly monthlyAmount: Money;
	readonly anchorDay: number; // 1–31
}

// A ledger entry. `kind` discriminates a normal spend from a one-off
// adjustment; `amount` is signed (see `entry.ts` for the convention).
export interface Expense {
	readonly id: string;
	readonly kind: EntryKind;
	readonly amount: Money;
	readonly note: string | null;
	readonly createdAt: Date;
}
