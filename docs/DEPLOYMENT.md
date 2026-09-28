# Deployment

## Option A: single VM with Docker Compose (recommended to start)

Use a single server with 2 vCPU, 4 GB RAM and Ubuntu 22.04 or later, running Docker and the compose plugin.

```bash
git clone https://github.com/SandHani45/solar-workflow-automate.git && cd solar-workflow-automate
cp .env.example .env
# Edit .env: set strong JWT_ACCESS_SECRET / JWT_REFRESH_SECRET, MONGO_ROOT_PASSWORD,
# SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD, and APP_URL=https://app.yourdomain.com
docker compose up -d --build
docker compose ps                          # all services healthy
docker compose exec api node dist/seed.js  # optional: demo org and users
```

Put a TLS reverse proxy in front of the `web` service (port 3000). With Caddy:

```
app.yourdomain.com {
  reverse_proxy localhost:3000
}
```

The browser only ever talks to the web app. `/api/v1/*` is proxied to the API inside the Docker
network, so auth cookies stay first-party and you don't have to publish the API port. Remove the
`ports` mapping from the `api` service once the reverse proxy is in place.

### Backups

```bash
docker compose exec mongo mongodump --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --db solarflow --archive --gzip > backup-$(date +%F).gz
```

Also back up the `uploads` volume, which holds customer documents and photos. For multi-server
setups, switch the storage driver to S3.

### Upgrades

```bash
git pull && docker compose up -d --build
```

## Option B: managed services

- **Database:** MongoDB Atlas. Set `MONGODB_URI` to the Atlas SRV connection string.
- **API:** any container host (Render, Railway, Fly.io, AWS ECS or Cloud Run) using `apps/api/Dockerfile`
  with the repo root as the build context. Give it a persistent volume for `UPLOAD_DIR`, or use S3.
- **Web:** a container host using `apps/web/Dockerfile`. Set `API_INTERNAL_URL` to the API's internal
  URL. See `apps/web/README.md` for how the proxy reads it.

## Environment variables

See `.env.example`; each variable is documented inline. In production, always set:
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (48+ random bytes each), `APP_URL`, `MONGODB_URI`,
`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` (change the password after the first login).
