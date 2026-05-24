import { defineConfig } from "vitest/config";

/**
 * Vitest config — kept separate from `vite.config.ts` so the test runner
 * doesn't pull in the TanStack Start / devtools / Tailwind plugin chain.
 *
 * Domain tests are pure TS and run in Node. We deliberately do **not**
 * preload jsdom: the domain layer has no DOM dependencies, and component
 * tests aren't part of the MVP test strategy (see PRODUCT.md "Testing").
 */
export default defineConfig({
	resolve: {
		alias: {
			"#": new URL("./src/", import.meta.url).pathname,
			"@": new URL("./src/", import.meta.url).pathname,
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
