import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import type { ReactNode } from "react";
import { NotFound } from "./components/not-found";
import TanstackQueryProvider, {
	getContext,
} from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// App-wide 404. Replaces the bare `<p>Not Found</p>` fallback and silences
		// the dev "notFoundError on __root__, no notFoundComponent" warning.
		defaultNotFoundComponent: NotFound,

		Wrap: (props: { children: ReactNode }) => {
			return (
				<TanstackQueryProvider context={context}>
					{props.children}
				</TanstackQueryProvider>
			);
		},
	});

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
