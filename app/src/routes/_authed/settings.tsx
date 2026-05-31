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
 *
 * BudgetForm is a child component keyed on `${cents}-${anchor}-${locale}`.
 * Remounting via `key` seeds fresh `useState` defaults whenever the server
 * values change (e.g. after a successful save), so no `useEffect` is needed to
 * mirror server state into local form state. Including `locale` in the key
 * ensures a language switch also remounts the form so `centsToInputString`
 * (locale-aware separator) re-seeds `amount` with the correct format — without
 * it the child would keep the old separator while `parseAmount` uses the new
 * locale's rule, causing a spurious validation error on save.
 */

import { Trans, useLingui } from "@lingui/react/macro";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Money } from "#/domain";
import { useBudget, useSetBudget } from "#/hooks/use-budget";
import type { SupportedCurrency, SupportedLocale } from "#/i18n/config";
import { useLocaleContext } from "#/i18n/locale-context";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";
import { useFormat } from "#/i18n/use-format";
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

// ---------------------------------------------------------------------------
// BudgetForm — owns the amount/anchorDay/error form state.
//
// Seeded from `initialAmount`/`initialAnchor` props via useState default; no
// effect needed. The parent keys this on `${cents}-${anchor}` so it remounts
// (and thus re-seeds) whenever the underlying server values change.
// ---------------------------------------------------------------------------

interface BudgetFormProps {
	initialAmount: string;
	initialAnchor: string;
	onSave: (monthlyAmount: Money, anchorDay: number) => Promise<void>;
	isPending: boolean;
}

function BudgetForm({
	initialAmount,
	initialAnchor,
	onSave,
	isPending,
}: BudgetFormProps) {
	const { t } = useLingui();
	const { parseAmount } = useFormat();
	const getErrorMessage = useErrorMessage();
	const [amount, setAmount] = useState(initialAmount);
	const [anchorDay, setAnchorDay] = useState(initialAnchor);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		let monthlyAmount: Money;
		try {
			monthlyAmount = Money.fromCents(parseAmount(amount));
		} catch {
			setError(getErrorMessage("INVALID_AMOUNT"));
			return;
		}
		if (monthlyAmount.isNegative() || monthlyAmount.equals(Money.zero())) {
			setError(getErrorMessage("BUDGET_NOT_POSITIVE"));
			return;
		}

		const anchor = Number(anchorDay);
		if (!Number.isInteger(anchor) || anchor < 1 || anchor > 31) {
			setError(getErrorMessage("ANCHOR_OUT_OF_RANGE"));
			return;
		}

		try {
			await onSave(monthlyAmount, anchor);
		} catch (e) {
			setError(e instanceof Error ? e.message : getErrorMessage("SAVE_FAILED"));
		}
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
			<div className="flex flex-col gap-2">
				<Label htmlFor="amount">
					<Trans>Monthly budget</Trans>
				</Label>
				<Input
					id="amount"
					name="amount"
					inputMode="decimal"
					autoComplete="off"
					placeholder={t`e.g. 300`}
					required
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="anchorDay">
					<Trans>Cycle starts on day</Trans>
				</Label>
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
					<Trans>
						If a month doesn't have your day (e.g. 31 in February), the cycle
						starts on the last day of that month instead.
					</Trans>
				</p>
			</div>
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
			<Button type="submit" disabled={isPending}>
				{isPending ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
			</Button>
		</form>
	);
}

// ---------------------------------------------------------------------------
// PreferencesSwitcher — language and currency selects.
//
// Reads from and writes to `LocaleContext`; the context's `setPreferences`
// updates client state instantly (re-renders all <Trans> + useFormat() callers)
// and fires the DB/cookie persist mutation in the background.
// ---------------------------------------------------------------------------

function PreferencesSwitcher() {
	const { locale, currency, setPreferences } = useLocaleContext();
	const { t } = useLingui();

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<Trans>Language & currency</Trans>
				</CardTitle>
				<CardDescription>
					<Trans>
						Changes apply instantly. Your preference is saved to your account.
					</Trans>
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="language-select">
						<Trans>Language</Trans>
					</Label>
					<Select
						value={locale}
						onValueChange={(value) =>
							setPreferences({ locale: value as SupportedLocale })
						}
					>
						<SelectTrigger id="language-select">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="en">English</SelectItem>
							<SelectItem value="de">Deutsch</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="currency-select">
						<Trans>Currency</Trans>
					</Label>
					<Select
						value={currency}
						onValueChange={(value) =>
							setPreferences({
								currency: value as SupportedCurrency,
							})
						}
					>
						<SelectTrigger id="currency-select">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="EUR">{t`EUR — Euro`}</SelectItem>
							<SelectItem value="USD">{t`USD — US Dollar`}</SelectItem>
							<SelectItem value="GBP">{t`GBP — British Pound`}</SelectItem>
							<SelectItem value="CHF">{t`CHF — Swiss Franc`}</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// SettingsPage — page-level concerns: loading budget, logout, coordination.
// ---------------------------------------------------------------------------

function SettingsPage() {
	const { t } = useLingui();
	const { centsToInputString } = useFormat();
	const { locale } = useLocaleContext();
	const router = useRouter();
	const setBudget = useSetBudget();
	const budget = useBudget();
	const getErrorMessage = useErrorMessage();
	const [loggingOut, setLoggingOut] = useState(false);

	// Derive initial form values from server state at render time — no effect.
	const loadedCents = budget?.monthlyAmount.toCents();
	const loadedAnchor = budget?.anchorDay;

	async function handleSave(monthlyAmount: Money, anchorDay: number) {
		try {
			await setBudget.mutateAsync({ monthlyAmount, anchorDay });
		} catch (e) {
			// Re-throw as an Error with the Module-H translated message so BudgetForm
			// can catch it and display it inline. Stop exposing raw server e.message.
			throw new Error(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
		}
		// Re-run loaders so the server-rendered budget on home is fresh too.
		await router.invalidate();
		toast.success(t`Budget updated.`);
	}

	async function handleLogout() {
		setLoggingOut(true);
		await authClient.signOut();
		// Re-run loaders so the guard kicks the user back to /login.
		await router.invalidate();
		await router.navigate({ to: "/login" });
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-8">
			<header>
				<h1 className="font-medium text-lg">
					<Trans>Settings</Trans>
				</h1>
				<p className="text-muted-foreground text-sm">
					<Trans>
						Change your monthly budget and cycle start. Changes apply to the
						current cycle immediately.
					</Trans>
				</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>
						<Trans>Budget</Trans>
					</CardTitle>
					<CardDescription>
						<Trans>Edits apply retroactively across the current cycle.</Trans>
					</CardDescription>
				</CardHeader>
				<CardContent>
					{loadedCents !== undefined && loadedAnchor !== undefined ? (
						// Key remounts BudgetForm with fresh defaults when server values change.
						<BudgetForm
							key={`${loadedCents}-${loadedAnchor}-${locale}`}
							initialAmount={centsToInputString(loadedCents)}
							initialAnchor={String(loadedAnchor)}
							onSave={handleSave}
							isPending={setBudget.isPending}
						/>
					) : (
						<p className="text-muted-foreground text-sm">
							<Trans>Loading…</Trans>
						</p>
					)}
				</CardContent>
			</Card>

			<PreferencesSwitcher />

			<Button onClick={handleLogout} variant="outline" disabled={loggingOut}>
				{loggingOut ? <Trans>Logging out…</Trans> : <Trans>Log out</Trans>}
			</Button>
		</div>
	);
}
