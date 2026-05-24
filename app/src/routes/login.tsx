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
import { authClient } from "#/lib/auth-client";
import { getServerSession } from "#/lib/auth-server";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await getServerSession();
		if (session) {
			throw redirect({ to: "/" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSubmitting(true);
		const result = await authClient.signIn.email({ email, password });
		setSubmitting(false);
		if (result.error) {
			setError(result.error.message ?? "Could not sign in.");
			return;
		}
		await router.invalidate();
		await router.navigate({ to: "/" });
	}

	return (
		<div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-8">
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold">Log in</h1>
				<p className="text-muted-foreground text-sm">
					Welcome back. Enter your details to continue.
				</p>
			</div>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
				<div className="flex flex-col gap-2">
					<Label htmlFor="email">Email</Label>
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
					<Label htmlFor="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
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
					{submitting ? "Logging in…" : "Log in"}
				</Button>
			</form>
			<p className="text-muted-foreground text-sm">
				No account yet?{" "}
				<Link to="/signup" className="text-foreground underline">
					Sign up
				</Link>
			</p>
		</div>
	);
}
