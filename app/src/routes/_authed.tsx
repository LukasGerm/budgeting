import {
	createFileRoute,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { BottomNav } from "#/components/bottom-nav";
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
 * Renders the routed page plus the persistent bottom nav. Onboarding is the
 * one authed screen without the nav — there's no budget yet and it's a guided
 * flow, so the tabs would dead-end.
 *
 * This wrapper owns the viewport height: it's a `min-h-svh` flex column, and
 * the nav clearance (`pb-16`) lives on this same element. Because Tailwind uses
 * border-box, that padding counts *inside* the 100svh rather than adding to it,
 * so the document is exactly one viewport tall and won't scroll on short pages.
 * Pages fill it with `flex-1` and only grow (scroll) when content overflows.
 */
function AuthedLayout() {
	const { pathname } = useLocation();
	const showNav = pathname !== "/onboarding";

	return (
		<div className={cn("flex min-h-svh flex-col", showNav && "pb-16")}>
			<Outlet />
			{showNav ? <BottomNav /> : null}
		</div>
	);
}
