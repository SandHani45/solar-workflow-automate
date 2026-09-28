# syntax=docker/dockerfile:1
# SolarFlow API — build context is the monorepo root:
#   docker build -f apps/api/Dockerfile -t solarflow-api .

# ── base: Node 22 + pnpm via corepack ──
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    # tests only: don't download a MongoDB binary during install
    MONGOMS_DISABLE_POSTINSTALL=1
RUN corepack enable
WORKDIR /repo

# ── build: install from the lockfile, bundle with tsup, create a prod-only deploy ──
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Download every package in the lockfile into the store (cached until the lockfile changes).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile --filter "@solar/api..."
RUN pnpm --filter @solar/api build
# @solar/shared is bundled into dist, so the deploy only needs runtime dependencies.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter @solar/api deploy --prod --legacy /out

# ── runtime ──
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
