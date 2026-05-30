import { auth } from "#/lib/auth";
import type { TRPCContext } from "./init";

/**
 * Per-request tRPC context factory.
 *
 * Reads the Better Auth session off the inbound `Request` headers and exposes
 * the user id (or null for anonymous calls). Kept separate from `init.ts` so the
 * procedure builders / router stay free of the Better Auth import — only the
 * HTTP route handler (which actually has a request) pulls this in.
 */
export async function createTRPCContext({
	req,
}: {
	req: Request;
}): Promise<TRPCContext> {
	const session = await auth.api.getSession({ headers: req.headers });
	return {
		userId: session?.user.id ?? null,
	};
}
