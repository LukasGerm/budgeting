import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { TRPCRouter } from "#/integrations/trpc/router";

/**
 * tRPC + TanStack Query bindings. `TRPCProvider` wires the client into the
 * React tree (used by root-provider); `useTRPC` is the documented hook for
 * consuming procedures in components (see CLAUDE.md). Kept as the integration's
 * public API even while no component reads it yet.
 *
 * @public
 */
export const { TRPCProvider, useTRPC } = createTRPCContext<TRPCRouter>();
