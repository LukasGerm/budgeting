import { lingui, linguiTransformerBabelPreset } from "@lingui/vite-plugin";
import babel from "@rolldown/plugin-babel";
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
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart(),
		nitro(),
		viteReact(),
		lingui(),
		// Transform Lingui macros (Trans, t, msg, …) to runtime calls.
		// Must come AFTER viteReact() so JSX is already handled.
		babel({ presets: [linguiTransformerBabelPreset()] }),
	],
});

export default config;
