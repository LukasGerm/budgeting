import { Trans } from "@lingui/react/macro";
import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	errorCodeFromBetterAuth,
	useErrorMessage,
} from "#/i18n/use-error-message";
import { authClient } from "#/lib/auth-client";
import { getServerSession } from "#/lib/auth-server";

export const Route = createFileRoute("/signup")({
	beforeLoad: async () => {
		const session = await getServerSession();
		if (session) {
			throw redirect({ to: "/" });
		}
	},
	component: SignupPage,
});

function SignupPage() {
	const router = useRouter();
	const getErrorMessage = useErrorMessage();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSubmitting(true);
		// Better Auth requires a `name`; we don't collect one in MVP, so reuse the
		// email as a placeholder. Slice 6 (Settings) can let users pick a real one
		// if/when we ever surface it.
		const result = await authClient.signUp.email({
			email,
			password,
			name: email,
		});
		setSubmitting(false);
		if (result.error) {
			const code = errorCodeFromBetterAuth(result) ?? "UNKNOWN";
			setError(getErrorMessage(code));
			return;
		}
		await router.invalidate();
		await router.navigate({ to: "/" });
	}

	return (
		<div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-8">
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold">
					<Trans>Sign up</Trans>
				</h1>
				<p className="text-muted-foreground text-sm">
					<Trans>Create an account to start tracking your budget.</Trans>
				</p>
			</div>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
				<div className="flex flex-col gap-2">
					<Label htmlFor="email">
						<Trans>Email</Trans>
					</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="password">
						<Trans>Password</Trans>
					</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						required
						minLength={8}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</div>
				{error ? (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}
				<Button type="submit" disabled={submitting}>
					{submitting ? (
						<Trans>Creating account…</Trans>
					) : (
						<Trans>Sign up</Trans>
					)}
				</Button>
			</form>
			<p className="text-muted-foreground text-sm">
				<Trans>
					Already have an account?{" "}
					<Link to="/login" className="text-foreground underline">
						Log in
					</Link>
				</Trans>
			</p>
		</div>
	);
}
