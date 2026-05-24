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

export const Route = createFileRoute("/_authed/onboarding")({
	component: OnboardingPage,
});

function OnboardingPage() {
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

		await router.invalidate();
		await router.navigate({ to: "/" });
	}

	return (
		<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
			<Card>
				<CardHeader>
					<CardTitle>Set up your budget</CardTitle>
					<CardDescription>
						Tell us your monthly amount and which day of the month your cycle
						starts.
					</CardDescription>
				</CardHeader>
				<CardContent>
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
						<Button type="submit" disabled={setBudget.isPending}>
							{setBudget.isPending ? "Saving…" : "Save and continue"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
