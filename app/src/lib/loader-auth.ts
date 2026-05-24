import { redirect } from "@tanstack/react-router";
import { TRPCClientError } from "@trpc/client";

/**
 * Run an authed route's loader prefetches, turning a tRPC `UNAUTHORIZED` into a
 * redirect to `/login` instead of letting it surface as the error boundary.
 *
 * The `_authed` `beforeLoad` already bounces sessionless visitors (via
 * `getServerSession`), and SSR tRPC calls now forward the auth cookie, so a
 * valid session authenticates everywhere. This is the belt-and-suspenders case:
 * a token that lapses between that guard and these queries — or a procedure
 * that rejects on its own — should send the user back to log in, not render
 * "Something went wrong! UNAUTHORIZED".
 */
export async function withLoginRedirect<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (
			error instanceof TRPCClientError &&
			error.data?.code === "UNAUTHORIZED"
		) {
			throw redirect({ to: "/login" });
		}
		throw error;
	}
}
