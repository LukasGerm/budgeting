/**
 * Server-side locale resolution.
 *
 * Uses `getWebRequest()` from TanStack Start to access the incoming request
 * headers (cookie + Accept-Language). Returns a `ResolvedPrefs` that is safe
 * to serialise into the root loader data and pass to the client for hydration
 * parity — both the server render and the client rehydration read from the same
 * resolved value so React never sees a mismatch.
 *
 * Issue 02: also reads the Better Auth session so that a logged-in user's
 * DB-persisted language + currency win over the cookie on every SSR. This gives
 * cross-device sync on first paint at zero extra client-side RTT.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { CURRENCY_COOKIE, LOCALE_COOKIE } from "#/i18n/config";
import { type ResolvedPrefs, resolvePrefs } from "#/i18n/resolver";
import { auth } from "#/lib/auth";

/**
 * Parse a cookie header string into a key→value map.
 * Handles URL-encoded values and ignores malformed pairs.
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
	if (!cookieHeader) return {};
	return Object.fromEntries(
		cookieHeader
			.split(";")
			.map((pair) => pair.trim().split("="))
			.filter((parts): parts is [string, string] => parts.length === 2)
			.map(([k, v]) => [k.trim(), decodeURIComponent(v.trim())]),
	);
}

/**
 * Server function that resolves locale + currency from the incoming request.
 *
 * Precedence (highest → lowest):
 *   1. Authenticated user's DB preference (language / currency columns)
 *   2. Cookie (LOCALE_COOKIE / CURRENCY_COOKIE)
 *   3. Accept-Language header (locale only)
 *   4. Default ("en" / "EUR")
 *
 * No cookie-cache is configured on the Better Auth session, so `getSession`
 * always reads the fresh DB value. An update via `user.setPreferences` is
 * immediately reflected on the next SSR without any cache invalidation dance.
 */
export const getResolvedPrefs = createServerFn({ method: "GET" }).handler(
	async (): Promise<ResolvedPrefs> => {
		const request = getRequest();
		const cookies = parseCookies(request.headers.get("cookie"));
		const acceptLanguage = request.headers.get("accept-language");

		// Attempt to read the Better Auth session — null for unauthenticated requests.
		const session = await auth.api.getSession({ headers: request.headers });

		return resolvePrefs({
			// DB preference wins over cookie; resolver already implements this order.
			userLocale: session?.user?.language ?? null,
			userCurrency: session?.user?.currency ?? null,
			cookieLocale: cookies[LOCALE_COOKIE] ?? null,
			cookieCurrency: cookies[CURRENCY_COOKIE] ?? null,
			acceptLanguage,
		});
	},
);
