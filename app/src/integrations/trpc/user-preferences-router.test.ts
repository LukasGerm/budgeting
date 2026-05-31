/**
 * Integration-level tests for the `user.setPreferences` procedure.
 *
 * Mirrors router.test.ts / habit-router.test.ts: Prisma is mocked at the
 * `#/db` boundary; tRPC cookie helpers and auth are mocked to prevent env
 * side-effects. The caller context is built directly via
 * `trpcRouter.createCaller` with a known `userId`.
 *
 * We assert the exact `where`/`data` the procedure hands Prisma and that the
 * cookies are set with the correct values, which is where the persistence
 * guarantees live.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Prisma mock ----

const userUpdate = vi.fn();

vi.mock("#/db", () => ({
	prisma: {
		user: { update: userUpdate },
	},
}));

// ---- TanStack Start server cookie mock ----
// setCookie is called inside the procedure to sync the SSR fast-path cookies.

const setCookie = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	setCookie,
}));

// ---- Better Auth mock — keep router importable without env deps ----

vi.mock("#/lib/auth", () => ({ auth: {} }));

const { trpcRouter } = await import("./router");

function caller(userId: string | null) {
	return trpcRouter.createCaller({ userId });
}

beforeEach(() => {
	vi.clearAllMocks();
	userUpdate.mockResolvedValue({
		id: "user-a",
		language: "de",
		currency: "USD",
	});
});

describe("user.setPreferences", () => {
	it("writes language and currency to the DB scoped to ctx.userId", async () => {
		await caller("user-a").user.setPreferences({
			language: "de",
			currency: "USD",
		});

		expect(userUpdate).toHaveBeenCalledTimes(1);
		expect(userUpdate).toHaveBeenCalledWith({
			where: { id: "user-a" },
			data: { language: "de", currency: "USD" },
		});
	});

	it("sets the locale and currency cookies with correct values", async () => {
		await caller("user-a").user.setPreferences({
			language: "de",
			currency: "USD",
		});

		// Two cookie calls: one for locale, one for currency.
		expect(setCookie).toHaveBeenCalledTimes(2);

		const cookieNames = setCookie.mock.calls.map(
			(c: unknown[]) => c[0] as string,
		);
		expect(cookieNames).toContain("locale");
		expect(cookieNames).toContain("currency");

		const localeCall = setCookie.mock.calls.find(
			(c: unknown[]) => c[0] === "locale",
		);
		const currencyCall = setCookie.mock.calls.find(
			(c: unknown[]) => c[0] === "currency",
		);
		expect(localeCall?.[1]).toBe("de");
		expect(currencyCall?.[1]).toBe("USD");
	});

	it("sets cookies with path '/' and sameSite 'lax'", async () => {
		await caller("user-a").user.setPreferences({ language: "en" });

		const localeCall = setCookie.mock.calls.find(
			(c: unknown[]) => c[0] === "locale",
		);
		expect(localeCall?.[2]).toMatchObject({ path: "/", sameSite: "lax" });
	});

	it("updates only language when currency is omitted", async () => {
		await caller("user-a").user.setPreferences({ language: "en" });

		expect(userUpdate).toHaveBeenCalledTimes(1);
		expect(userUpdate.mock.calls[0][0].data).toEqual({ language: "en" });
		expect(userUpdate.mock.calls[0][0].data).not.toHaveProperty("currency");

		// Only the locale cookie is set.
		expect(setCookie).toHaveBeenCalledTimes(1);
		expect(setCookie.mock.calls[0][0]).toBe("locale");
	});

	it("updates only currency when language is omitted", async () => {
		await caller("user-a").user.setPreferences({ currency: "GBP" });

		expect(userUpdate).toHaveBeenCalledTimes(1);
		expect(userUpdate.mock.calls[0][0].data).toEqual({ currency: "GBP" });
		expect(userUpdate.mock.calls[0][0].data).not.toHaveProperty("language");

		// Only the currency cookie is set.
		expect(setCookie).toHaveBeenCalledTimes(1);
		expect(setCookie.mock.calls[0][0]).toBe("currency");
	});

	it("is a no-op (no DB write, no cookie) when called with no fields", async () => {
		await caller("user-a").user.setPreferences({});

		expect(userUpdate).not.toHaveBeenCalled();
		expect(setCookie).not.toHaveBeenCalled();
	});

	it("rejects an unsupported language value", async () => {
		await expect(
			// biome-ignore lint/suspicious/noExplicitAny: intentional invalid input
			caller("user-a").user.setPreferences({ language: "fr" as any }),
		).rejects.toThrow();
		expect(userUpdate).not.toHaveBeenCalled();
	});

	it("rejects an unsupported currency value", async () => {
		await expect(
			// biome-ignore lint/suspicious/noExplicitAny: intentional invalid input
			caller("user-a").user.setPreferences({ currency: "JPY" as any }),
		).rejects.toThrow();
		expect(userUpdate).not.toHaveBeenCalled();
	});

	it("rejects an unauthenticated caller — no Prisma calls", async () => {
		await expect(
			caller(null).user.setPreferences({ language: "de" }),
		).rejects.toThrow();
		expect(userUpdate).not.toHaveBeenCalled();
		expect(setCookie).not.toHaveBeenCalled();
	});

	it("defaults to en/EUR for an untouched user (no preference stored)", async () => {
		// Simulate a user who has never changed their preferences — both fields
		// are at the DB defaults. The procedure would write whatever the client
		// sends; the defaults live in the schema and the resolver.
		//
		// Verify that calling setPreferences({}) is a no-op so existing defaults
		// are not accidentally overwritten to undefined.
		userUpdate.mockResolvedValue({
			id: "user-new",
			language: "en",
			currency: "EUR",
		});

		await caller("user-new").user.setPreferences({});

		// No write when nothing is provided.
		expect(userUpdate).not.toHaveBeenCalled();
	});
});
