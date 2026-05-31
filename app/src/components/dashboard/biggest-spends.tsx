/**
 * BiggestSpends — the Dashboard's final card: a short, read-only list of the
 * largest SPEND entries this cycle, biggest first, with their notes.
 *
 * Pure presentational: it takes the already-derived `Expense[]` (the output of
 * `biggestSpends`) and renders it, so it's component-testable in isolation
 * (props in, JSX out — no hooks, no data fetching). The amount renders via
 * `useFormat().formatMoney` and is the prominent line; the note is muted
 * below it, falling back to "No note" when an entry has none.
 *
 * The whole card is **hidden when there are no spends this cycle** (`spends`
 * empty ⇒ `return null`) — there's nothing worth ranking yet.
 *
 * This reuses the amount-prominent / note-muted visual idiom of `ExpenseRow`,
 * but deliberately does NOT reuse that component: the dashboard list is
 * read-only and carries no edit/delete affordances (and only ever shows
 * spends, so no adjustment sign handling is needed).
 */

import { Trans } from "@lingui/react/macro";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import type { Expense } from "#/domain";
import { useFormat } from "#/i18n/use-format";

interface BiggestSpendsProps {
	spends: Expense[];
}

export function BiggestSpends({ spends }: BiggestSpendsProps) {
	const { formatMoney } = useFormat();

	// No spends this cycle → hide the whole card.
	if (spends.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<Trans>Biggest spends</Trans>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-col">
					{spends.map((spend) => (
						<li
							key={spend.id}
							className="flex items-baseline justify-between gap-3 py-3"
						>
							<span className="min-w-0 truncate text-muted-foreground text-sm">
								{spend.note ?? <Trans>No note</Trans>}
							</span>
							<span className="shrink-0 font-medium text-base tabular-nums">
								{formatMoney(spend.amount.toCents())}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
