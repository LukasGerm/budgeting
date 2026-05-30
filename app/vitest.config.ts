import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Vitest config — kept separate from `vite.config.ts` so the test runner
 * doesn't pull in the TanStack Start / devtools / Tailwind plugin chain.
 *
 * Domain tests are pure TS and run in Node — the default `environment` stays
 * "node" so they pay no jsdom cost. Component tests (`.test.tsx`, e.g. the
 * Dashboard widgets) opt into jsdom *per file* via a `// @vitest-environment
 * jsdom` docblock, so only the files that touch the DOM load it.
 *
 * The tRPC integration test (`router.test.ts`) hits the real dev Postgres, so it
 * needs `DATABASE_URL`. The Prisma scripts load it via `dotenv -e .env.local`,
 * but `pnpm test` doesn't, and Vite only exposes `VITE_`-prefixed vars to
 * `import.meta.env` — never `process.env`. We surface every `.env.local` var to
 * `process.env` via `test.env` (empty prefix = load all keys), so the Prisma
 * singleton can read `DATABASE_URL` at import time. Pure domain/component tests
 * don't touch it and are unaffected.
 */
export default defineConfig(({ mode }) => ({
	resolve: {
		alias: {
			"#": new URL("./src/", import.meta.url).pathname,
			"@": new URL("./src/", import.meta.url).pathname,
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		env: loadEnv(mode, process.cwd(), ""),
	},
}));
