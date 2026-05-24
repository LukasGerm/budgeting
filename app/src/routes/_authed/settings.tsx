/**
 * Settings — edit the monthly budget amount and the anchor day, and log out.
 *
 * Both edits write through `budget.set` (upsert) via `useSetBudget`. Because
 * the home daily/monthly numbers are recomputed from `useBudget` on every
 * render, a saved change applies retroactively across the current cycle the
 * moment the budget query refreshes — no special logic here.
 *
 * The form pre-fills from the loaded budget. Money is parsed decimal-EUR↔cents
 * only at this UI edge (mirroring onboarding); the domain only ever sees cents.
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Money } from "#/domain";
import { useBudget, useSetBudget } from "#/hooks/use-budget";
import { authClient } from "#/lib/auth-client";
import { withLoginRedirect } from "#/lib/loader-auth";

export const Route = createFileRoute("/_authed/settings")({
	// Server-first: prefetch the budget so the suspense query resolves from
	// cache on first paint and the form pre-fills with no loading flash.
	loader: async ({ context }) => {
		await withLoginRedirect(() =>
			context.queryClient.ensureQueryData(
				context.trpc.budget.get.queryOptions(),
			),
		);
	},
	component: SettingsPage,
});

function SettingsPage() {
	const router = useRouter();
	const setBudget = useSetBudget();
	const budget = useBudget();

	const [amount, setAmount] = useState("");
	const [anchorDay, setAnchorDay] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loggingOut, setLoggingOut] = useState(false);

	// Pre-fill the form once the budget loads (or changes after a save). Use the
	// integer cents as the key so we only reset the fields when the underlying
	// value actually changes, not on every render.
	const loadedCents = budget?.monthlyAmount.toCents();
	const loadedAnchor = budget?.anchorDay;
	useEffect(() => {
		if (loadedCents === undefined || loadedAnchor === undefined) {
			return;
		}
		setAmount((loadedCents / 100).toFixed(2).replace(".", ","));
		setAnchorDay(String(loadedAnchor));
	}, [loadedCents, loadedAnchor]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		let monthlyAmount: Money;
		try {
			monthlyAmount = Money.fromEuroString(amount);
		} catch {
			setError("Enter a valid amount in EUR (e.g. 300 or 1234,56).");
			return;
		}
		if (monthlyAmount.isNegative() || monthlyAmount.equals(Money.zero())) {
			setError("Budget must be greater than zero.");
			return;
		}

		const anchor = Number(anchorDay);
		if (!Number.isInteger(anchor) || anchor < 1 || anchor > 31) {
			setError("Anchor day must be between 1 and 31.");
			return;
		}

		try {
			await setBudget.mutateAsync({ monthlyAmount, anchorDay: anchor });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not save your budget.");
			return;
		}

		// Re-run loaders so the server-rendered budget on home is fresh too.
		await router.invalidate();
		toast.success("Budget updated.");
	}

	async function handleLogout() {
		setLoggingOut(true);
		await authClient.signOut();
		// Re-run loaders so the guard kicks the user back to /login.
		await router.invalidate();
		await router.navigate({ to: "/login" });
	}

	const isPending = setBudget.isPending;

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header>
				<h1 className="font-medium text-lg">Settings</h1>
				<p className="text-muted-foreground text-sm">
					Change your monthly budget and cycle start. Changes apply to the
					current cycle immediately.
				</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Budget</CardTitle>
					<CardDescription>
						Edits apply retroactively across the current cycle.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{budget ? (
						<form
							className="flex flex-col gap-4"
							onSubmit={handleSubmit}
							noValidate
						>
							<div className="flex flex-col gap-2">
								<Label htmlFor="amount">Monthly budget (EUR)</Label>
								<Input
									id="amount"
									name="amount"
									inputMode="decimal"
									autoComplete="off"
									placeholder="e.g. 300"
									required
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="anchorDay">Cycle starts on day</Label>
								<Input
									id="anchorDay"
									name="anchorDay"
									type="number"
									inputMode="numeric"
									min={1}
									max={31}
									required
									value={anchorDay}
									onChange={(e) => setAnchorDay(e.target.value)}
								/>
								<p className="text-muted-foreground text-xs">
									If a month doesn't have your day (e.g. 31 in February), the
									cycle starts on the last day of that month instead.
								</p>
							</div>
							{error ? (
								<p className="text-destructive text-sm" role="alert">
									{error}
								</p>
							) : null}
							<Button type="submit" disabled={isPending}>
								{isPending ? "Saving…" : "Save"}
							</Button>
						</form>
					) : (
						<p className="text-muted-foreground text-sm">Loading…</p>
					)}
				</CardContent>
			</Card>

			<Button onClick={handleLogout} variant="outline" disabled={loggingOut}>
				{loggingOut ? "Logging out…" : "Log out"}
			</Button>
		</div>
	);
}
