# SubterraDB

**Self-hosted Supabase, multi-project.**

Run dozens of isolated Supabase projects on a single server with the same SDK developers already use.

[Quick start](#-quick-start) · [Architecture](#-architecture) · [Features](#-features) · [MCP](#-mcp-server) · [Roadmap](#-roadmap)

---

## We love Supabase. SubterraDB is not a replacement.

Supabase is one of the best things that has happened to web development in years. We use it. We pay for it. We recommend it.

SubterraDB exists for **one specific pain point**: the official self-hosted distribution gives you one Supabase project per VM. If your team needs ten dev projects, that's ten VMs and ~40 GB of RAM. SubterraDB collapses that down to **one VM, one shared Postgres, dozens of projects** — while keeping the SDK contract identical so your code moves to Supabase Cloud in production with zero changes.

If you only need one project, **use Supabase**. They built it, they host it better than you ever will, and you should pay them for it. SubterraDB only makes sense when "one project per VM" is the thing in your way.

---

## What is SubterraDB?

Each project gets its own isolated database, its own PostgREST + GoTrue + Storage + Realtime containers, its own gateway routes — but they all share the same Postgres engine, the same Kong gateway, and the same control plane GUI.

The killer detail: **the official `@supabase/supabase-js` SDK works against SubterraDB without code changes**. A developer points the client at the SubterraDB gateway in development, then swaps to Supabase Cloud in production by changing nothing but `URL` and `ANON_KEY`.

```js
// dev — pointing at SubterraDB
const supabase = createClient('http://my-server:58000/my-app', ANON_KEY);
await supabase.from('notes').insert({ body: 'works' });
await supabase.auth.signUp({ email: 'me@x.com', password: '...' });
await supabase.storage.from('avatars').upload('me.png', file);

// prod — pointing at Supabase Cloud, same code
const supabase = createClient('https://xyz.supabase.co', PROD_ANON_KEY);
```

---

## ⚡ Quick start

You need a Linux box (Debian, Ubuntu, Fedora, etc.) or macOS with **Docker** + **Docker Compose plugin** installed. That's it — no Node.js, no npm, no manual DB migrations.

```bash
git clone https://github.com/epick/subterradb.git
cd subterradb
./bin/install.sh
```

The installer will:

1. Verify Docker + the Compose plugin are installed and the daemon is reachable
2. Generate a strong `SUBTERRADB_JWT_SECRET` and bootstrap admin password
3. Detect the host's public IP and write it to `.env`
4. Build the GUI image (~3-5 min the first time)
5. Bring up the full stack and wait until every service is healthy
6. Print the GUI URL and the admin credentials

When it finishes, open the URL it prints and log in. Done.

---

## 🔐 Security model — read this before deploying

> **SubterraDB is intended for use behind a reverse proxy with TLS, on a private LAN, or behind a VPN. Do NOT expose the GUI, the Postgres port, or the Kong admin API directly to the public internet.**

This is the same security model as the official Supabase self-hosted distribution and every other "self-hosted backend stack" out there. Self-hosted Supabase (and SubterraDB by extension) ships a developer database with full superuser access intentionally exposed for tools like `psql`, `pgAdmin`, `prisma migrate`, and the MCP server. That's the **product**, not a misconfiguration. But it means a public-internet deployment without hardening is the same as leaving an unlocked admin panel on the open internet.

### Threat model

| Component | Port | Default bind | Risk if public | What it's for |
|---|---|---|---|---|
| Kong proxy (gateway) | `58000` | `0.0.0.0` | **OK** — every route is gated by `key-auth` + per-project ACL. This is THE port that has to be reachable. | Where developer SDK clients connect (`createClient(...)`) |
| Postgres | `55432` | `0.0.0.0` | **HIGH** — full superuser access if the password leaks | Direct DB access for `psql` / `pgAdmin` / MCP from a developer's laptop |
| GUI (Next.js) | `3000` | `0.0.0.0` | **HIGH** — login is over plain HTTP unless TLS terminated by a proxy | Control plane: project lifecycle, SQL editor, table editor, etc. |
| Kong Admin API | `58001` | **`127.0.0.1`** (hard-coded) | Critical if exposed — Kong admin has no auth | Internal: only the GUI container talks to this, via the docker network |
| Per-project containers (postgrest, gotrue, storage, realtime) | random | docker network only | **OK** — never bound to host | Internal: Kong routes traffic to them |

### Going to production: two paths

Pick **one** of these. Both work. The "right" choice depends on whether end users (SDK clients) live on the public internet or on a private network.

#### Path A — Reverse proxy + TLS (most common)

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

#### Path B — Tailscale / WireGuard / ZeroTier (simpler, smaller user base)

For a homelab, an internal team tool, or a personal project where everyone who needs access is on a shared VPN.

1. **Put the VPS or VM inside your tailnet/WireGuard mesh.**
2. **Block the public network at the firewall** (`ufw deny in`, security groups, etc.) — only allow traffic on the VPN interface.
3. Leave the SubterraDB ports as default (`0.0.0.0`); they're now only reachable through the VPN interface. No reverse proxy or TLS cert needed.
4. **Update `KONG_PROXY_URL` and `SUBTERRADB_PUBLIC_DB_HOST`** to the Tailscale hostname:
   ```bash
   KONG_PROXY_URL=http://subterradb.your-tailnet.ts.net:58000
   SUBTERRADB_PUBLIC_DB_HOST=subterradb.your-tailnet.ts.net
   ```

This is the path I recommend for small teams or solo dev — it's **strictly more secure** than path A because there's no public attack surface at all, and you don't have to babysit TLS renewals.

### The minimum non-negotiables

If you take nothing else from this section, do these three things before exposing SubterraDB to a public network:

1. **Strong `POSTGRES_PASSWORD`**. The installer does this on fresh installs. If you have an existing install where it's still `postgres`, rotate it now.
2. **Bind `58001` to localhost.** Already hard-coded in `docker-compose.yml`. Don't change it.
3. **Bind `3000` and `55432` to localhost** if the host is on a public network. Use a reverse proxy or VPN as described above.

---

## 📸 Screenshot

![Multi-project dashboard](docs/screenshots/02-dashboard.png)

---

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          Your VM / server                       │
│                                                                 │
│  ┌──────────────────┐         ┌────────────────────────────┐   │
│  │  SubterraDB GUI  │────────▶│   Kong gateway              │   │
│  │  (Next.js 16)    │  Admin  │   v3.7.1, DB mode           │   │
│  │  port 3000       │   API   │   :58000 proxy              │   │
│  │                  │         │   :58001 admin (internal)   │   │
│  └────────┬─────────┘         └─────────────┬──────────────┘   │
│           │ dockerode                       │                    │
│           │ /var/run/docker.sock            │                    │
│           ▼                                 ▼                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Per-project containers (4 per project)                  │  │
│  │  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌─────────────┐ │  │
│  │  │postgrest_a │ │gotrue_a  │ │storage_a│ │realtime_a   │ │  │
│  │  └────────────┘ └──────────┘ └─────────┘ └─────────────┘ │  │
│  │  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌─────────────┐ │  │
│  │  │postgrest_b │ │gotrue_b  │ │storage_b│ │realtime_b   │ │  │
│  │  └─────┬──────┘ └─────┬────┘ └────┬────┘ └──────┬──────┘ │  │
│  └────────┼──────────────┼───────────┼─────────────┼────────┘  │
│           └──────────────┴───────────┴─────────────┘            │
│                                │                                 │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   Postgres 15 (shared)                                   │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │   │
│  │   │ proj_a   │  │ proj_b   │  │ subterradb_system│      │   │
│  │   └──────────┘  └──────────┘  └──────────────────┘      │   │
│  │   wal_level=logical (for Realtime)                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

**RAM footprint:** ~1 GB infrastructure + ~200 MB per project. Ten projects fit comfortably in **4 GB total**, vs ~40 GB for ten separate Supabase VMs.

---

## ✨ Features

### Control plane
- Email + password auth with bcrypt + JWT (independent from any project's GoTrue)
- Two roles: `admin` (manages everything) and `developer` (sees only assigned projects)
- Audit log foundation for tracking platform actions

### Project lifecycle (one click each)
- **Create** — provisions a database, 4 containers, and Kong routes in ~20 seconds
- **Stop** — pauses the per-project containers, keeps the database and Kong intact
- **Start** — resumes a stopped project in ~3 seconds
- **Delete** — confirmation dialog, then full teardown

### In-GUI tools — replaces Supabase Studio for multi-project use
- **SQL Editor** with Monaco — runs as `service_role` inside a transaction with rollback on error
- **Table Editor** with inline cell editing, frozen first column, multi-row selection, insert/edit/delete
- **Auth Manager** — list and delete users in any project's GoTrue auth schema
- **Storage Browser** — bucket CRUD + file upload/download/delete via the official Storage API
- **Logs Viewer** — live tail of any container's stdout/stderr via Server-Sent Events
- **Gateway view** — live snapshot of every Kong service, route, and plugin

### Compatibility
- The official `@supabase/supabase-js` SDK works against SubterraDB **without code changes** — only `URL` and `ANON_KEY` differ between SubterraDB (dev) and Supabase Cloud (prod)
- Same plugin set as Supabase Cloud: `key-auth`, `cors`, `acl`, `request-transformer`
- Per-project ACL isolation enforced at the gateway (cross-project keys → 403)

### Internationalization
- English (default) and Spanish out of the box
- Every string passes through `next-intl` — zero hardcoded text in the UI
- Easy to add more locales: drop a JSON file into `messages/`

---

## 🔌 MCP Server

SubterraDB ships with [`@subterradb/mcp-server`](https://www.npmjs.com/package/@subterradb/mcp-server) — a Model Context Protocol server published on npm that exposes any project's database to Cursor, Claude Code, Claude Desktop, Cline, Windsurf, and any other MCP-aware editor.

**Zero install on the developer machine.** The MCP runs via `npx`, so all anyone needs is Node 18+ on their laptop and the snippet from the GUI. The Connection Card on every project page generates a ready-to-paste `mcp.json` with the project's real URL, service key, and database URL pre-filled — copy → paste into your editor's MCP config → done.

```json
{
  "mcpServers": {
    "subterradb-my-app": {
      "command": "npx",
      "args": ["-y", "--package=@subterradb/mcp-server", "mcp-server"],
      "env": {
        "SUBTERRADB_URL": "http://your-server:58000/my-app",
        "SUBTERRADB_SERVICE_KEY": "eyJhbGc...",
        "SUBTERRADB_DB_URL": "postgresql://postgres:postgres@your-server:55432/proj_my_app"
      }
    }
  }
}
```

The package itself stores no URLs — all configuration is per-server in `env`, so the same developer can have multiple SubterraDB projects (and the official Supabase Cloud MCP) coexisting in the same `mcp.json`.

Tools exposed: `get_project_info`, `list_tables`, `execute_sql`, `list_users`. Names mirror the official Supabase MCP so switching between local SubterraDB and Supabase Cloud projects is friction-free.

See [`packages/mcp-server/README.md`](packages/mcp-server/README.md) for the full configuration reference, or the [npm page](https://www.npmjs.com/package/@subterradb/mcp-server) for the latest version.

---

## 🛠 Configuration

All runtime configuration lives in `.env` at the repo root. The installer creates one for you with sensible defaults; the values you'll most likely want to change for production are documented in [`.env.example`](.env.example).

| Variable | Default | When to override |
|---|---|---|
| `KONG_PROXY_URL` | `http://localhost:58000` | Set to your VM's public hostname so the connection card shows reachable URLs |
| `SUBTERRADB_PUBLIC_DB_HOST` | auto-detected | Same — used in the database connection string the GUI displays |
| `SUBTERRADB_JWT_SECRET` | generated | Never share, never reuse between deployments |
| `SUBTERRADB_ADMIN_PASSWORD` | generated | The installer prints this once on first run |
| `POSTGRES_PASSWORD` | `postgres` | Override for any non-local deployment |

---

## 🐳 Stack

| Component | Image | Purpose |
|---|---|---|
| Postgres | `postgres:15-alpine` | Shared database engine, one DB per project |
| Kong | `kong:3.7.1` (DB mode) | API gateway with dynamic route registration |
| GUI | built from `Dockerfile` | Next.js 16 + bundled MCP server |
| PostgREST | `postgrest/postgrest:v12.2.0` | One container per project |
| GoTrue | `supabase/gotrue:v2.158.1` | One container per project |
| Storage | `supabase/storage-api:v1.11.13` | One container per project |
| Realtime | `supabase/realtime:v2.30.34` | One container per project |

---

## 🗺 Roadmap

Things that aren't here yet, in rough priority order:

- [ ] RLS policy editor with assisted UI
- [ ] ER diagram of every project's schema
- [ ] Backups + point-in-time restore
- [ ] Edge Functions per project
- [ ] Logflare + Vector for historical log retention

---

## 🤝 Contributing

PRs welcome. For substantial features, please open an issue first to discuss the design before writing code.

---

## 📜 License

MIT. See [`LICENSE`](LICENSE) for the full text.

---

Made with ❤️ in Chicago.
