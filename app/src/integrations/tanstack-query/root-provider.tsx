import { QueryClient } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ReactNode } from "react";
import superjson from "superjson";
import { TRPCProvider } from "#/integrations/trpc/react";
import type { TRPCRouter } from "#/integrations/trpc/router";

function getUrl() {
	const base = (() => {
		if (typeof window !== "undefined") return "";
		return `http://localhost:${process.env.PORT ?? 3000}`;
	})();
	return `${base}/api/trpc`;
}

/**
 * The `Cookie` header to attach to SSR tRPC requests.
 *
 * During SSR the route loaders call tRPC over HTTP *from the server*, so —
 * unlike a browser fetch — the Better Auth cookie isn't attached for us.
 * Reading the inbound request's cookie and forwarding it lets protected
 * procedures see the same session the server-fn guards (`getServerSession`) do;
 * without it, every hard load of an authed route 401s on the server even for a
 * perfectly valid session.
 *
 * `createIsomorphicFn` is required (not a `typeof window` branch): it lets the
 * TanStack Start compiler strip the `.server()` body — and the server-only
 * `getRequest` import it uses — out of the client bundle, which the
 * `import-protection` plugin otherwise rejects at build time. On the client the
 * header is "" because the browser attaches cookies to the same-origin request.
 */
const getSsrCookie = createIsomorphicFn()
	.client(() => "")
	.server(() => getRequest()?.headers.get("cookie") ?? "");

export const trpcClient = createTRPCClient<TRPCRouter>({
	links: [
		httpBatchStreamLink({
			transformer: superjson,
			url: getUrl(),
			headers() {
				const cookie = getSsrCookie();
				return cookie ? { cookie } : {};
			},
		}),
	],
});

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			dehydrate: { serializeData: superjson.serialize },
			hydrate: { deserializeData: superjson.deserialize },
		},
	});

	const serverHelpers = createTRPCOptionsProxy({
		client: trpcClient,
		queryClient: queryClient,
	});
	const context = {
		queryClient,
		trpc: serverHelpers,
	};

	return context;
}

export default function TanstackQueryProvider({
	children,
	context,
}: {
	children: ReactNode;
	context: ReturnType<typeof getContext>;
}) {
	const { queryClient } = context;

	return (
		<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
			{children}
		</TRPCProvider>
	);
}
