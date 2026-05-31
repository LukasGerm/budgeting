import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { prisma } from "#/db";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [tanstackStartCookies()],
	user: {
		additionalFields: {
			/**
			 * UI language preference (BCP-47 subtag: "en" | "de").
			 * Written only by the server-side `user.setPreferences` tRPC mutation;
			 * `input: false` prevents clients from setting it at sign-up.
			 */
			language: {
				type: "string",
				required: false,
				defaultValue: "en",
				input: false,
			},
			/**
			 * Display currency preference ("EUR" | "USD" | "GBP" | "CHF").
			 * Display-only — amounts are never converted; only the symbol changes.
			 */
			currency: {
				type: "string",
				required: false,
				defaultValue: "EUR",
				input: false,
			},
		},
	},
});
