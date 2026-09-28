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

## Option C: Railway (MongoDB, API and web in one project)

The repo includes a Railway config file for each service (`apps/api/railway.json`, `apps/web/railway.json`).
Both build from their Dockerfile, with the repo root as the build context.

1. **MongoDB.** Add the MongoDB database to the project. It exposes `MONGO_URL`, e.g.
   `mongodb://mongo:<password>@mongodb.railway.internal:27017`. That address only works inside the
   Railway project, so the API must also run on Railway.
2. **API service.** Use New → GitHub repo → this repository. Then set:
   - *Settings → Config-as-code → Railway config file:* `/apps/api/railway.json`
   - *Settings → Source → Branch:* your deploy branch. Leave the root directory empty (repo root).
   - *Variables:*
     ```
     MONGODB_URI=${{MongoDB.MONGO_URL}}
     MONGODB_DB_NAME=solarflow
     PORT=4000
     NODE_ENV=production
     JWT_ACCESS_SECRET=<48+ random bytes, hex>
     JWT_REFRESH_SECRET=<48+ random bytes, hex, different>
     APP_URL=https://<web service public domain>
     SUPER_ADMIN_EMAIL=you@yourcompany.com
     SUPER_ADMIN_PASSWORD=<strong password>
     UPLOAD_DIR=/data/uploads
     RAILWAY_RUN_UID=0
     SEED_DEMO_ON_BOOT=true      # optional: demo org and users on first boot, never overwrites
     ```
     `${{MongoDB.MONGO_URL}}` is a Railway reference variable, so the database password is never
     copied anywhere. Use your MongoDB service's name if it isn't `MongoDB`.
   - *Volume:* attach one mounted at `/data/uploads`, where customer documents and photos are stored.
     Railway mounts volumes as root, which is why `RAILWAY_RUN_UID=0` is set.
   - No public domain is needed. The web service reaches the API over the private network.
3. **Web service.** Add the same repository again as a second service:
   - *Config file:* `/apps/web/railway.json`
   - *Variables:*
     ```
     API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
     PORT=3000
     ```
     Replace `api` with your API service's name.
   - *Networking → Generate domain.* Then put that `https://…` URL into the API's `APP_URL` and redeploy the API.
4. **Check.** Open the web domain and sign in. With `SEED_DEMO_ON_BOOT=true`, use `owner@demo.solar` /
   `Demo@1234`. Your super admin is the email and password you set above. Once you have real
   data, set `SEED_DEMO_ON_BOOT=false`.

To reset the demo organisation later (only the demo org is touched), run `railway ssh` on the API service and then
`node dist/seed.js`.

## Environment variables

See `.env.example`; each variable is documented inline. In production, always set:
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (48+ random bytes each), `APP_URL`, `MONGODB_URI`,
`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` (change the password after the first login).
