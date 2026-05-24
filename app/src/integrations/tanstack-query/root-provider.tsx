import { QueryClient } from "@tanstack/react-query";
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

export const trpcClient = createTRPCClient<TRPCRouter>({
	links: [
		httpBatchStreamLink({
			transformer: superjson,
			url: getUrl(),
			/**
			 * During SSR the route loaders call tRPC over HTTP *from the server*, so
			 * unlike a browser fetch the Better Auth cookie isn't attached for us.
			 * Forward the inbound request's `Cookie` header here so protected
			 * procedures see the same session the server-fn guards (`getServerSession`)
			 * do — without this, every hard load of an authed route 401s on the
			 * server even for a perfectly valid session. On the client we return
			 * nothing; the browser attaches cookies to the same-origin request itself.
			 */
			async headers() {
				if (typeof window !== "undefined") return {};
				const { getRequest } = await import("@tanstack/react-start/server");
				const cookie = getRequest()?.headers.get("cookie");
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
