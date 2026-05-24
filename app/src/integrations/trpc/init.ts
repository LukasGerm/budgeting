import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "#/lib/auth";

/**
 * Per-request tRPC context.
 *
 * Reads the Better Auth session off the inbound `Request` headers and
 * exposes the user id (or null for anonymous calls). Procedures that need
 * auth gate on it via `protectedProcedure` below.
 */
export async function createTRPCContext({ req }: { req: Request }) {
	const session = await auth.api.getSession({ headers: req.headers });
	return {
		userId: session?.user.id ?? null,
	};
}

type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
	transformer: superjson,
});

export const createTRPCRouter = t.router;

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
