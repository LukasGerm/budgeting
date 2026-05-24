import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { prisma } from "#/db";
import { auth } from "#/lib/auth";

/**
 * Read the current user's Budget on the server.
 *
 * Used by the `_authed` layout's `beforeLoad` to decide whether the user
 * still needs to onboard. Returns `null` for unauthenticated callers as
 * well as for authenticated users who haven't onboarded yet — the caller
 * disambiguates by also reading the session.
 */
export const getServerBudget = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return null;
		const row = await prisma.budget.findUnique({
			where: { userId: session.user.id },
		});
		if (!row) return null;
		return {
			monthlyAmountCents: row.monthlyAmountCents,
			anchorDay: row.anchorDay,
		};
	},
);
