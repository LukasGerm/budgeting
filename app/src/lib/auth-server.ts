import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";

/**
 * Read the current Better Auth session on the server.
 *
 * Used by route `beforeLoad` guards to decide whether to redirect
 * unauthenticated visitors to `/login` (or send authed visitors away
 * from `/login` / `/signup`).
 */
export const getServerSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const request = getRequest();
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return null;
		return {
			user: {
				id: session.user.id,
				email: session.user.email,
			},
		};
	},
);
