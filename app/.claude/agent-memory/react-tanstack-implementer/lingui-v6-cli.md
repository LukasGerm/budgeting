---
name: lingui-v6-cli
description: Lingui v6 CLI extract/compile quirks — Node <22.18 import.meta.main bug; committed wrapper scripts at scripts/i18n-extract.mjs and scripts/i18n-compile.mjs
metadata:
  type: project
---

`pnpm extract` and `pnpm compile` silently exit 0 doing nothing on Node v22.15 because Lingui CLI 6.1.0 guards command bodies behind `if (import.meta.main)`, which is `undefined` on Node <22.18 (only became truthy in Node 22.18+).

**Permanent fix (Issue 04 review):** Committed wrapper scripts at `app/scripts/i18n-extract.mjs` and `app/scripts/i18n-compile.mjs`. These call the extract/compile command functions directly (bypassing the `import.meta.main` guard) by importing from absolute pnpm store paths:
- `node_modules/.pnpm/@lingui+conf@6.1.0/node_modules/@lingui/conf/dist/index.mjs` — for `getConfig`
- `node_modules/.pnpm/@lingui+cli@6.1.0/node_modules/@lingui/cli/dist/lingui-extract.js` / `lingui-compile.js` — for the command functions
- `node_modules/.pnpm/@lingui+cli@6.1.0/node_modules/@lingui/cli/dist/api/resolveWorkersOptions.js` — for the options object

`package.json` scripts `"extract"` and `"compile"` now invoke these wrappers: `node scripts/i18n-extract.mjs` / `node scripts/i18n-compile.mjs`.

`pnpm extract --` (via the script) doesn't pass args — to run with `--clean` call `node scripts/i18n-extract.mjs --clean` directly.

**If pnpm store paths change after a Lingui upgrade:** resolve the new path via `node -e "console.log(require.resolve('@lingui/conf'))"` with NODE_PATH set as in the `.bin/lingui` shim, and update the absolute imports in the wrapper scripts.

The `src/locales/*/messages.ts` compiled output is excluded from biome (added `"!**/src/locales/**/*.ts"` to `biome.json` includes) because it's minified machine-generated output.

**Vitest needs Lingui plugins too:** Components that import `@lingui/react/macro` or `@lingui/core/macro` will fail in tests with `Cannot find package 'babel-plugin-macros'` unless the `lingui()` and `babel({ presets: [linguiTransformerBabelPreset()] })` plugins are added to `vitest.config.ts`.

**Plural in imperative aria-labels:** The `t(plural(...))` combination from `@lingui/react/macro` + `@lingui/core/macro` has TypeScript type issues (`plural` returns `string`, not `MacroMessageDescriptor`). Workaround: use separate `t` tagged template literals for singular/plural forms (ternary approach).

**Also required:** `@lingui/format-po` must be a direct devDep (not just transitive) for the default `.po` catalog format to load.

Related: [[i18n-architecture]]
