import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { Toaster } from "#/components/ui/sonner";
import type { SupportedCurrency, SupportedLocale } from "#/i18n/config";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "#/i18n/config";
import { getResolvedPrefs } from "#/i18n/locale-server";
import { I18nSetupProvider } from "#/i18n/provider";
import { useTRPC } from "#/integrations/trpc/react";
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
			// PWA / theme. Dark zinc base (matches `--background` in the `.dark` palette).
			{ name: "theme-color", content: "#131316" },
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
	// Resolve locale + currency on every request from cookie / Accept-Language /
	// DB preference (for authed users). Returning it from the loader makes it
	// available to the shell component so both the SSR render and client hydration
	// read the same value — no mismatch.
	loader: async () => {
		const prefs = await getResolvedPrefs();
		return { prefs };
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const { prefs } = Route.useLoaderData() ?? {
		prefs: { locale: DEFAULT_LOCALE, currency: DEFAULT_CURRENCY },
	};

	const trpc = useTRPC();

	// Background mutation: writes DB columns + sets SSR cookies. The UI
	// switches instantly (via provider state); this runs fire-and-forget.
	// Errors are silently swallowed — the UI already updated optimistically,
	// and a failed persist is recoverable on the next page load from the DB.
	const persistPrefs = useMutation(trpc.user.setPreferences.mutationOptions());

	function handleSetPreferences(next: {
		locale?: SupportedLocale;
		currency?: SupportedCurrency;
	}) {
		// Map the UI's `locale` key to the mutation's `language` key. The DB column
		// and tRPC input schema speak `language`; the LocaleContext speaks `locale`.
		// All keys are optional in the mutation input, so only include defined ones.
		const input: { language?: SupportedLocale; currency?: SupportedCurrency } =
			{};
		if (next.locale !== undefined) input.language = next.locale;
		if (next.currency !== undefined) input.currency = next.currency;
		persistPrefs.mutate(input);
	}

	return (
		<html lang={prefs.locale} className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				<I18nSetupProvider
					locale={prefs.locale}
					currency={prefs.currency}
					onSetPreferences={handleSetPreferences}
				>
					{children}
					<Toaster />
				</I18nSetupProvider>
				<Scripts />
			</body>
		</html>
	);
}
