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

![Login screen](docs/screenshots/01-login.png)

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

## 📸 Screenshots

### Multi-project dashboard

![Dashboard](docs/screenshots/02-dashboard.png)

### Project overview — connection details + quick actions

![Project detail](docs/screenshots/03-project-detail.png)

### Table editor — frozen first column when scrolling wide tables

![Table editor](docs/screenshots/04-table-editor.png)

### Inline cell editor — click any cell, edit in place

![Inline cell editor](docs/screenshots/09-inline-cell-editor.png)

### SQL editor — full Monaco with results

![SQL editor](docs/screenshots/05-sql-editor.png)

### Storage browser — buckets, upload, download, delete

![Storage browser](docs/screenshots/06-storage-browser.png)

### Logs viewer — live tail of every per-project container

![Logs viewer](docs/screenshots/07-logs-viewer.png)

### Gateway view — every Kong route + plugin in real time

![Gateway](docs/screenshots/08-gateway.png)

### MCP config — copy-paste into Cursor / Claude Code / Windsurf

![MCP config card](docs/screenshots/10-mcp-config.png)

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

SubterraDB ships with `@subterradb/mcp-server` — a Model Context Protocol server that exposes any project's database to Cursor, Claude Code, Claude Desktop, Cline, Windsurf, and any other MCP-aware editor.

The Connection Card on every project page generates a ready-to-paste `mcp.json` snippet with the project's real env vars filled in. **Copy → paste → done** — no placeholder substitution required.

```json
{
  "mcpServers": {
    "subterradb-my-app": {
      "command": "node",
      "args": ["/path/to/subterradb/packages/mcp-server/dist/index.js"],
      "env": {
        "SUBTERRADB_URL": "http://your-server:58000/my-app",
        "SUBTERRADB_SERVICE_KEY": "eyJhbGc...",
        "SUBTERRADB_DB_URL": "postgresql://postgres:...@your-server:55432/proj_my_app"
      }
    }
  }
}
```

Tools exposed: `get_project_info`, `list_tables`, `execute_sql`, `list_users`. Names mirror the official Supabase MCP so the two can coexist in the same editor config — flip between them based on whether you're targeting local SubterraDB or Supabase Cloud.

See [`packages/mcp-server/README.md`](packages/mcp-server/README.md) for full details.

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

- [x] Phase 0 — Control plane + auth + Kong provisioning
- [x] Phase 1.5 — Per-project PostgREST + GoTrue containers
- [x] Phase 2 — In-GUI SQL editor, Table editor (read), Auth manager
- [x] Phase 3 — Per-project Storage + Realtime, Logs viewer, MCP server, Table editor (write)
- [x] Production-ready Docker deployment + bootstrap installer
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
