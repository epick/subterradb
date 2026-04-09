<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/subterradb-logo-dark.svg">
    <img alt="SubterraDB" src="assets/brand/subterradb-logo-light.svg" width="320">
  </picture>
</p>

<p align="center">
  <strong>Self-hosted Supabase, multi-project.</strong><br/>
  Run dozens of isolated Supabase projects on a single VM with the same SDK developers already use.
</p>

---

## We love Supabase. SubterraDB is not a replacement.

Supabase is one of the best things that has happened to web development in years. We use it. We pay for it. We recommend it.

SubterraDB exists for **one specific pain point**: the official Supabase self-hosted distribution gives you exactly one project per VM. If your team needs ten dev projects, that's ten VMs and ~80 GB of RAM. SubterraDB collapses that to **one VM, one shared Postgres, ~18-20 projects** — while keeping the SDK contract identical so your code moves to Supabase Cloud in production with zero changes.

**If you only need one project, use Supabase.** They built it, they host it better than you ever will, and you should pay them for it. SubterraDB only makes sense when "one project per VM" is the thing in your way.

## What is SubterraDB?

Each project gets its own isolated database, its own PostgREST + GoTrue + Storage + Realtime containers, and its own gateway routes — but they all share the same Postgres engine and the same Kong gateway. The official `@supabase/supabase-js` SDK works against SubterraDB without any code changes:

```js
// dev — pointing at SubterraDB
const supabase = createClient('http://my-server:58000/my-app', ANON_KEY);
await supabase.from('notes').insert({ body: 'works' });
await supabase.auth.signUp({ email: 'me@x.com', password: '...' });
await supabase.storage.from('avatars').upload('me.png', file);

// prod — pointing at Supabase Cloud, same code
const supabase = createClient('https://xyz.supabase.co', PROD_ANON_KEY);
```

![SubterraDB dashboard](docs/screenshots/02-dashboard.png)

## ⚡ Quick start

You need a Linux box (Debian, Ubuntu, Fedora, etc.) or macOS with **Docker** + **Docker Compose plugin** installed. That's it.

```bash
git clone https://github.com/epick/subterradb.git
cd subterradb
./bin/install.sh
```

The installer generates strong secrets, detects your host's public IP, builds the image, brings the stack up, and runs a smoke test. When it finishes, open the URL it prints and log in.

## 🔄 Upgrading

```bash
cd subterradb
git pull
./bin/install.sh
```

`bin/install.sh` is idempotent. It preserves all your secrets, applies any pending schema migrations on GUI startup, and runs a smoke test before reporting success. If the upgrade triggered a postgres container recreate, the installer auto-restarts every per-project container so their connection pools refresh — you don't have to think about it.

See [`CHANGELOG.md`](CHANGELOG.md) for what each version brings.

## 🔌 MCP server

SubterraDB ships with [`@subterradb/mcp-server`](https://www.npmjs.com/package/@subterradb/mcp-server) — a Model Context Protocol server published on npm. **Zero install on the developer machine.** Anyone with Node 18+ uses it via `npx` from their MCP config. The Connection card on every project page generates a ready-to-paste `mcp.json` snippet with the project's real URL, service key, and database URL pre-filled:

```json
{
  "mcpServers": {
    "subterradb-my-project": {
      "command": "npx",
      "args": ["-y", "--package=@subterradb/mcp-server", "mcp-server"],
      "env": {
        "SUBTERRADB_URL": "http://your-server:58000/my-project",
        "SUBTERRADB_SERVICE_KEY": "eyJhbGc...",
        "SUBTERRADB_DB_URL": "postgresql://postgres:...@your-server:55432/proj_my_project"
      }
    }
  }
}
```

Tools exposed: `get_project_info`, `list_tables`, `execute_sql`, `list_users`. Names mirror the official Supabase MCP so switching between local SubterraDB and Supabase Cloud is friction-free — the two coexist in the same `mcp.json`.

## 🔐 Before exposing to the public internet

SubterraDB is intended for use **behind a reverse proxy with TLS, on a private LAN, or behind a VPN**. Same posture as official Supabase self-host. Read [`SECURITY.md`](SECURITY.md) for the threat model and the two recommended deployment paths (reverse proxy + TLS, or Tailscale / WireGuard / ZeroTier).

## 📜 License

MIT. See [`LICENSE`](LICENSE).

---

<p align="center">
  Made with ❤️ in Chicago.
</p>
