/**
 * Pure helpers for the routine builder's draft-exercise list.
 * No React, Prisma, or tRPC imports — unit-tested in routine.test.ts.
 */

/**
 * Return a copy of `items` with the element at `index` moved one step up
 * (`delta = -1`) or down (`delta = 1`).
 *
 * Out-of-range moves (first item up, last item down, invalid index) return
 * the original array unchanged, so callers can wire this straight to
 * always-enabled arrow buttons without bounds checks.
 */
export function moveItem<T>(
	items: readonly T[],
	index: number,
	delta: -1 | 1,
): T[] {
	const target = index + delta;
	if (index < 0 || index >= items.length) return [...items];
	if (target < 0 || target >= items.length) return [...items];
	const next = [...items];
	const [moved] = next.splice(index, 1);
	next.splice(target, 0, moved);
	return next;
}
