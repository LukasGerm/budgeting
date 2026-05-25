import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { Toaster } from "#/components/ui/sonner";
import type { TRPCRouter } from "#/integrations/trpc/router";
// Side-effect import (not `?url`): lets TanStack Start inject the stylesheet
// <link> from the *client* manifest. The `?url` form bakes in the SSR build's
// own CSS hash, which diverges from the client hash on some build platforms
// (e.g. the Linux Docker build) → the SSR <link> 404s and styles only appear
// after client hydration.
import "../styles.css";

interface MyRouterContext {
	queryClient: QueryClient;

	trpc: TRPCOptionsProxy<TRPCRouter>;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{
				title: "Budgeting",
			},
			// PWA / theme. Dark base (`--bg-base` in the `.dark` palette).
			{ name: "theme-color", content: "#0a1418" },
			// iOS standalone (home-screen) install support.
			{ name: "mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black-translucent",
			},
			{ name: "apple-mobile-web-app-title", content: "Budget" },
		],
		links: [
			// Web app manifest (contents in public/manifest.json).
			{ rel: "manifest", href: "/manifest.json" },
			// iOS home-screen icon.
			{ rel: "apple-touch-icon", href: "/logo192.png" },
			{ rel: "icon", href: "/favicon.ico" },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}
