import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	// Nitro is the deployment-agnostic server layer: with it, `vite build` emits a
	// self-contained Node server at `.output/server/index.mjs` (run via the `start`
	// script). It must come after `tanstackStart()`. See the TanStack Start hosting
	// guide.
	plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
});

export default config;
