# syntax=docker/dockerfile:1.7
# SolarFlow web (Next.js standalone). Build context = repo root:
#   docker build -f apps/web/Dockerfile -t solarflow-web .
#
# API_INTERNAL_URL is read at RUNTIME by src/proxy.ts (not baked into the build), so the same image
# works against any API: docker run -e API_INTERNAL_URL=http://api:4000 -p 3000:3000 solarflow-web

ARG NODE_VERSION=22-alpine

# ── deps: fetch the whole store from the lockfile only (cache-friendly) ──
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm fetch

# ── build ──
FROM deps AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "@solar/web..."
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @solar/web build

# ── runtime: only the traced standalone server ──
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_INTERNAL_URL=http://api:4000
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
# outputFileTracingRoot is the repo root, so the server lives at apps/web/server.js.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
