import { Trans, useLingui } from "@lingui/react/macro";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
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
import { useSetBudget } from "#/hooks/use-budget";
import { errorCodeFromTRPC, useErrorMessage } from "#/i18n/use-error-message";
import { useFormat } from "#/i18n/use-format";

export const Route = createFileRoute("/_authed/onboarding")({
	component: OnboardingPage,
});

function OnboardingPage() {
	const { t } = useLingui();
	const { parseAmount } = useFormat();
	const getErrorMessage = useErrorMessage();
	const router = useRouter();
	const setBudget = useSetBudget();

	const [amount, setAmount] = useState("");
	const [anchorDay, setAnchorDay] = useState("1");
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
			await setBudget.mutateAsync({ monthlyAmount, anchorDay: anchor });
		} catch (e) {
			setError(getErrorMessage(errorCodeFromTRPC(e) ?? "SAVE_FAILED"));
			return;
		}

		await router.invalidate();
		await router.navigate({ to: "/" });
	}

	return (
		<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
			<Card>
				<CardHeader>
					<CardTitle>
						<Trans>Set up your budget</Trans>
					</CardTitle>
					<CardDescription>
						<Trans>
							Tell us your monthly amount and which day of the month your cycle
							starts.
						</Trans>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="flex flex-col gap-4"
						onSubmit={handleSubmit}
						noValidate
					>
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
									If a month doesn't have your day (e.g. 31 in February), the
									cycle starts on the last day of that month instead.
								</Trans>
							</p>
						</div>
						{error ? (
							<p className="text-destructive text-sm" role="alert">
								{error}
							</p>
						) : null}
						<Button type="submit" disabled={setBudget.isPending}>
							{setBudget.isPending ? (
								<Trans>Saving…</Trans>
							) : (
								<Trans>Save and continue</Trans>
							)}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
