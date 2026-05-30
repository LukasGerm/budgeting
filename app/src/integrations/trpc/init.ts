import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

/**
 * Per-request tRPC context shape: the authenticated caller's id (or null for
 * anonymous calls). Procedures that need auth gate on it via
 * `protectedProcedure` below.
 *
 * The *production* context is built from the request in `context.ts`
 * (`createTRPCContext`), which reads the Better Auth session. That lives in its
 * own module so importing the procedure builders / router here does NOT pull in
 * Better Auth — keeping the router import-safe for a direct server-side caller
 * (e.g. integration tests via `createCallerFactory`).
 */
export interface TRPCContext {
	userId: string | null;
}

const t = initTRPC.context<TRPCContext>().create({
	transformer: superjson,
});

export const createTRPCRouter = t.router;

/**
 * Build a server-side caller for the router with an injected context — the
 * direct, in-process way to invoke procedures without the HTTP/auth layer.
 * Production wires context from the request (`createTRPCContext`); tests use this
 * to call procedures with a known `userId`.
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Unauthenticated procedure builder. Part of the tRPC scaffold trio
 * (`createTRPCRouter` / `publicProcedure` / `protectedProcedure`); kept as the
 * base for any future public endpoint even though every current procedure is
 * `protectedProcedure`.
 *
 * @public
 */
export const publicProcedure = t.procedure;

/**
 * Procedure that throws UNAUTHORIZED if the caller has no session.
 * On success, `ctx.userId` is narrowed to `string`.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.userId) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({ ctx: { userId: ctx.userId } });
});
