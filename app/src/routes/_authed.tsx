import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { BottomNav } from "#/components/bottom-nav";
import { Button } from "#/components/ui/button";
import { getServerSession } from "#/lib/auth-server";
import { getServerBudget } from "#/lib/budget-server";
import { cn } from "#/lib/utils";

interface AuthedUser {
	id: string;
	email: string;
}

interface BudgetSnapshot {
	monthlyAmountCents: number;
	anchorDay: number;
}

interface AuthedContext {
	user: AuthedUser;
	serverBudget: BudgetSnapshot | null;
}

/**
 * Layout route guarding everything that requires a logged-in user.
 *
 * Server-authoritative, one place, two rules:
 *   1. No session → `/login`.
 *   2. Session but no budget → `/onboarding`, unless we're already there.
 *
 * Runs server functions only; no offline / client-store fallback. Children
 * read `{ user, serverBudget }` off the route context.
 */
export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ location }): Promise<AuthedContext> => {
		const session = await getServerSession();
		if (!session) {
			throw redirect({ to: "/login" });
		}

		// Already on /onboarding — let it render so the user can finish the flow.
		// Skipping the budget fetch saves a roundtrip too.
		if (location.pathname === "/onboarding") {
			return { user: session.user, serverBudget: null };
		}

		const budget = await getServerBudget();
		if (!budget) {
			throw redirect({ to: "/onboarding" });
		}

		return { user: session.user, serverBudget: budget };
	},
	component: AuthedLayout,
});

/**
 * Renders the routed page plus the persistent bottom nav and top app-bar.
 * Onboarding is the one authed screen without chrome — there's no budget yet
 * and it's a guided flow, so the tabs and gear would dead-end.
 *
 * Layout structure (flex column, full viewport):
 *   ┌─────────────────────────────────┐  ← safe-area-inset-top (iOS status bar)
 *   │ [sticky top app-bar: gear icon] │  ← ~3rem, sticky top-0
 *   │ <Outlet />                      │  ← flex-1, page content
 *   │ [fixed bottom nav]              │  ← ~4rem, fixed bottom-0
 *   └─────────────────────────────────┘  ← safe-area-inset-bottom
 *
 * The top app-bar is `sticky top-0` (not fixed) so it participates in document
 * flow — pages don't need extra top-padding because the bar pushes them down
 * naturally. Pages own their own `<header>` inside their content container; the
 * app-bar sits above them. Home's StreakChip is inside the page container (not
 * the app-bar), so there's no overlap.
 *
 * The nav clearance (`pb-[calc(4rem+...)]`) lives on the outer wrapper.
 */
function AuthedLayout() {
	const { pathname } = useLocation();
	const showNav = pathname !== "/onboarding";

	return (
		<div
			className={cn(
				// `pt-[env(safe-area-inset-top)]` keeps the header clear of the iOS
				// status bar (the web view renders under it in a standalone PWA).
				"flex min-h-svh flex-col pt-[env(safe-area-inset-top)]",
				// Clearance for the fixed bottom nav, plus the home-indicator inset
				// the nav now extends into.
				showNav && "pb-[calc(4rem_+_env(safe-area-inset-bottom))]",
			)}
		>
			{showNav ? (
				<header
					// Visually rhymes with the bottom nav: same blur/border treatment,
					// slightly higher z-index so it stays above page-level sticky elements.
					className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
				>
					{/* Constrain inner content to the same max-w-md as page bodies so the
					    gear aligns with page content, not the raw viewport edge. */}
					<div className="mx-auto flex max-w-md items-center justify-end px-8 py-2">
						<Button variant="ghost" size="icon" asChild>
							<Link to="/settings" aria-label="Settings">
								<Settings className="size-5" aria-hidden="true" />
							</Link>
						</Button>
					</div>
				</header>
			) : null}
			<Outlet />
			{showNav ? <BottomNav /> : null}
		</div>
	);
}
