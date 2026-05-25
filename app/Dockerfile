# syntax=docker/dockerfile:1
#
# Production image for the TanStack Start app.
#
# `vite build` (with the Nitro plugin in vite.config.ts) emits a self-contained
# Node server at `.output/server/index.mjs` — it bundles its own dependencies
# and serves both the SSR routes and the static client assets. So the runtime
# stage needs only Node + `.output`; no `node_modules`.
#
# Build context is the `app/` directory (the deploy base directory). Provide
# DATABASE_URL, BETTER_AUTH_SECRET and BETTER_AUTH_URL as runtime env vars.

# ---- Build stage: install deps and produce .output ----
FROM node:22-slim AS builder
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# pnpm, pinned by package.json "packageManager", via corepack.
RUN corepack enable

# Copy the full source (minus .dockerignore) before install so Prisma's
# postinstall can see prisma/schema.prisma.
COPY . .

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

RUN pnpm build

# ---- Runtime stage: just Node + the self-contained server ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Nitro listens on PORT (default 3000); the platform overrides it.
ENV PORT=3000
EXPOSE 3000

COPY --from=builder /app/.output ./.output

CMD ["node", ".output/server/index.mjs"]
