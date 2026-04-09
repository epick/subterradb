# Security model

> **SubterraDB is intended for use behind a reverse proxy with TLS, on a private LAN, or behind a VPN. Do NOT expose the GUI, the Postgres port, or the Kong admin API directly to the public internet.**

This is the same posture as the official Supabase self-hosted distribution and every other "self-hosted backend stack". Self-hosted Supabase ships a developer database with full superuser access intentionally exposed for tools like `psql`, `pgAdmin`, `prisma migrate`, and the MCP server. That's the **product**, not a misconfiguration. But it means a public-internet deployment without hardening is the same as leaving an unlocked admin panel on the open internet.

## Threat model

| Component | Port | Default bind | Risk if public | What it's for |
|---|---|---|---|---|
| Kong proxy (gateway) | `58000` | `0.0.0.0` | **OK** — every route is gated by `key-auth` + per-project ACL. This is THE port that has to be reachable. | Where developer SDK clients connect (`createClient(...)`) |
| Postgres | `55432` | `0.0.0.0` | **HIGH** — full superuser access if the password leaks | Direct DB access for `psql` / `pgAdmin` / MCP from a developer's laptop |
| GUI (Next.js) | `3000` | `0.0.0.0` | **HIGH** — login is over plain HTTP unless TLS terminated by a proxy | Control plane: project lifecycle, SQL editor, table editor, etc. |
| Kong Admin API | `58001` | **`127.0.0.1`** (hard-coded) | Critical if exposed — Kong admin has no auth | Internal: only the GUI container talks to this, via the docker network |
| Per-project containers (postgrest, gotrue, storage, realtime) | random | docker network only | **OK** — never bound to host | Internal: Kong routes traffic to them |

## Going to production: two paths

Pick **one** of these. Both work. The "right" choice depends on whether end users (SDK clients) live on the public internet or on a private network.

### Path A — Reverse proxy + TLS (most common)

For a VPS exposed to the public internet where developer apps will hit the gateway from anywhere.

1. **Lock the dangerous ports to localhost.** Edit `.env`:
   ```bash
   SUBTERRADB_BIND_GUI=127.0.0.1
   SUBTERRADB_BIND_DB=127.0.0.1
   SUBTERRADB_BIND_KONG_PROXY=127.0.0.1
   ```
   Then `docker compose --env-file .env up -d --force-recreate`.

2. **Put nginx / Caddy / Traefik in front** of the host listening on 80/443 with a real TLS cert (Let's Encrypt). Three locations to proxy:
   - `https://gui.your-domain.com` → `127.0.0.1:3000` (the GUI control plane)
   - `https://api.your-domain.com` → `127.0.0.1:58000` (the Kong gateway — what SDK clients hit)
   - **Do not proxy** Postgres (`55432`). Connect to it via SSH tunnel (`ssh -L 55432:localhost:55432 user@vps`) when you need direct DB access.

3. **Tell the GUI to issue Secure cookies** (now that there's TLS at the edge):
   ```bash
   SUBTERRADB_SECURE_COOKIES=true
   ```

4. **Update `KONG_PROXY_URL` and `SUBTERRADB_PUBLIC_DB_HOST`** in `.env` to the public hostnames so the GUI's connection cards show URLs that developers can actually use:
   ```bash
   KONG_PROXY_URL=https://api.your-domain.com
   SUBTERRADB_PUBLIC_DB_HOST=your-domain.com
   ```

5. **Rotate the bootstrap admin password** the first time you log in (Settings → change password).

6. **Verify Postgres has a strong password.** `bin/install.sh` generates one automatically on fresh installs, but if you upgraded an old install where it was `postgres`, the installer prints a warning at the top with the exact rotation commands.

### Path B — Tailscale / WireGuard / ZeroTier

For a homelab, an internal team tool, or a personal project where everyone who needs access is on a shared VPN.

1. **Put the VPS or VM inside your tailnet/WireGuard mesh.**
2. **Block the public network at the firewall** (`ufw deny in`, security groups, etc.) — only allow traffic on the VPN interface.
3. Leave the SubterraDB ports as default (`0.0.0.0`); they're now only reachable through the VPN interface. No reverse proxy or TLS cert needed.
4. **Update `KONG_PROXY_URL` and `SUBTERRADB_PUBLIC_DB_HOST`** to the Tailscale hostname:
   ```bash
   KONG_PROXY_URL=http://subterradb.your-tailnet.ts.net:58000
   SUBTERRADB_PUBLIC_DB_HOST=subterradb.your-tailnet.ts.net
   ```

This is **strictly more secure** than Path A because there's no public attack surface at all, and you don't have to babysit TLS renewals.

## The minimum non-negotiables

If you take nothing else from this document, do these three things before exposing SubterraDB to a public network:

1. **Strong `POSTGRES_PASSWORD`**. The installer does this on fresh installs. If you have an existing install where it's still `postgres`, rotate it now.
2. **Bind `58001` to localhost.** Already hard-coded in `docker-compose.yml`. Don't change it.
3. **Bind `3000` and `55432` to localhost** if the host is on a public network. Use a reverse proxy or VPN as described above.

## Operational caveat: postgres recreate ⇒ restart per-project containers

Per-project containers (`postgrest_*`, `gotrue_*`, `storage_*`, `realtime_*`) are launched dynamically by the SubterraDB control plane and do **not** live in `docker-compose.yml`. If the shared `subterradb-postgres` container is recreated for any reason — a `docker compose up -d` after editing the compose file, an image upgrade, etc. — the per-project containers keep their old TCP connection pools open against a postgres container that no longer exists. The next API call against any of them returns:

```
unable to fetch records: write failed: write tcp ...->...:5432: write: broken pipe
```

`bin/install.sh` handles this automatically: it captures postgres's container ID before and after `docker compose up`, and if it changed, restarts every per-project container in place. **You don't need to do anything if you upgrade with the installer.**

If you upgrade by running `docker compose` directly (skipping `bin/install.sh`), the manual fix is one HTTP call against the GUI's admin endpoint:

```bash
# Get a session cookie:
curl -c /tmp/sdb.cookies -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@subterra.local","password":"YOUR_ADMIN_PASSWORD"}'

# Restart every per-project container:
curl -b /tmp/sdb.cookies -X POST http://localhost:3000/api/admin/restart-project-containers
```

Or the equivalent shell one-liner if you're on the host:

```bash
docker ps --filter label=subterradb.project_slug --format '{{.Names}}' | xargs -r docker restart
```
