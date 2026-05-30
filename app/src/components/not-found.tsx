/**
 * NotFound — the app-wide 404, wired as the router's `defaultNotFoundComponent`
 * (see `router.tsx`). Replaces TanStack Router's bare `<p>Not Found</p>` fallback
 * and silences the dev-only "no notFoundComponent configured" warning.
 *
 * It owns its viewport height (`min-h-svh`) because it renders at the root,
 * outside the `_authed` layout that normally provides it.
 */

import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export function NotFound() {
	return (
		<div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
			<p className="font-semibold text-6xl text-muted-foreground tabular-nums tracking-tight">
				404
			</p>
			<div className="flex flex-col gap-1">
				<h1 className="font-medium text-lg">Page not found</h1>
				<p className="text-muted-foreground text-sm">
					That page doesn't exist or has moved.
				</p>
			</div>
			<Button asChild>
				<Link to="/">Go home</Link>
			</Button>
		</div>
	);
}
