# Changelog

All notable changes to SubterraDB are documented here. Format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

The version that's currently checked in lives in [`VERSION`](VERSION) at the repo root and is shown in the GUI sidebar.

## [0.2.2] — 2026-04-09

Patch fix: full audit of every hardcoded `localhost` / `postgres:postgres` / `:55432` in the source tree, with five real bugs fixed. The v0.2.1 fix only handled the env-vars-driven path (the MCP card); this release closes the hardcoded-value path (the Connection card and — most critically — GoTrue's email link generation).

### Fixed
- **`src/features/projects/components/connection-card.tsx`** had `const PROJECT_BASE_URL = 'http://localhost:58000'` hardcoded at the top of the file. The Connection card on every project page was showing `http://localhost:58000/{slug}` regardless of the host's real public IP. The Database URL row was even worse: hardcoded to `postgresql://postgres:${project.dbPassword}@localhost:55432/postgres`, which had THREE problems — wrong host (`localhost`), wrong password (the per-project authenticator role's password instead of the postgres superuser), and wrong database name (`/postgres` instead of `/proj_{slug}`). The card now receives `projectUrl` and `dbUrl` as props from the parent server component (`src/app/[locale]/(app)/projects/[id]/page.tsx`), which builds them from `env.kongProxyUrl`, `env.publicDbHost`, `env.publicDbPort`, and the new `env.postgresPassword`.
- **`src/server/containers.ts`** hardcoded `API_EXTERNAL_URL=http://localhost:58000/{slug}/auth/v1` and `GOTRUE_SITE_URL=http://localhost:58000` when launching per-project GoTrue containers. These values are baked into every email confirmation link, password reset link, magic link, and OAuth callback that GoTrue generates — meaning any developer trying to use email auth on their project would receive emails containing `localhost:58000` URLs that don't work from their laptop. Both now read from `env.kongProxyUrl`, which is populated by `bin/install.sh` from `hostname -I`. **This bug was invisible until someone tried email auth, which would have been a confusing production failure for the first user to hit it.**
- **`src/app/[locale]/(app)/projects/[id]/page.tsx`** hardcoded `postgres:postgres` as the user:password for the developer-facing DB connection URL. After v0.2.0 generates a strong random `POSTGRES_PASSWORD`, this hardcoded `postgres` password was wrong — `psql` connections built from the displayed URL would fail. Now reads from `env.postgresPassword` (URL-encoded so passwords with `+`, `/`, `=` work).

### Added
- **`env.postgresPassword`** getter in `src/server/env.ts`. Reads `POSTGRES_PASSWORD` from the environment with a `'postgres'` fallback for dev mode. Used to build the developer-facing DB connection string.
- **`POSTGRES_PASSWORD` is now passed through to the GUI container** in `docker-compose.yml`'s `subterradb-gui.environment` block. Prior to this it lived only in `SUBTERRADB_DATABASE_URL` and wasn't accessible directly.

### Why this matters
The v0.2.1 fix made me re-examine every place a URL or credential gets composed. Five hardcoded values survived the v0.2.0 audit because they were string literals inside component files, not env-var fallbacks. The honest postmortem: I should have caught these in the security pass and the pre-release validation. The fix here is exhaustive — `grep -rn 'localhost\|127\.0\.0\.1\|:55432\|:58000\|:58001\|postgres:postgres' src` returns only legitimate uses (internal docker network port literals like `postgrest:3000`, healthcheck URLs that run inside the container's own loopback, and `optional()` fallbacks in `env.ts` that are never hit when env vars are set correctly by `bin/install.sh`).

[0.2.2]: https://github.com/epick/subterradb/releases/tag/v0.2.2

## [0.2.1] — 2026-04-09

Patch fix: the GUI's Connection Card and MCP card were generating snippets with `localhost` for `SUBTERRADB_URL` and `SUBTERRADB_DB_URL`, which is wrong for any developer connecting from a different machine. Caught by manual testing of the freshly-installed v0.2.0 on the test VM.

### Fixed
- **`bin/install.sh` now treats `SUBTERRADB_PUBLIC_DB_HOST=localhost` as a sentinel** that triggers auto-detection from `hostname -I`, instead of accepting it as a real value. Same pattern as the existing `POSTGRES_PASSWORD=postgres` handling. The bug was that `.env.example` shipped `SUBTERRADB_PUBLIC_DB_HOST=localhost` as the default, so on `cp .env.example .env` the value was already populated, and the original install.sh's `[[ -z "$PUBLIC_HOST" ]]` check skipped the auto-detect entirely.
- **`.env.example`** now ships `SUBTERRADB_PUBLIC_DB_HOST` and `KONG_PROXY_URL` **commented out** by default. The installer fills them in with the real public IP via `hostname -I` on Linux, or falls back to `localhost` with a clear warning on macOS / hosts without `hostname -I`. Operators with a specific override (real domain, fixed LAN IP, reverse proxy URL) can uncomment and set them explicitly.

### Why it matters
- Without this fix, the snippets generated by the in-GUI MCP card and Connection Card showed `http://localhost:58000/...` and `postgresql://...@localhost:55432/...`, which any developer pasting into their MCP config from a different machine would have to manually rewrite to the host's real IP. Now the snippets are copy-paste-ready out of the box.
- For existing v0.2.0 installs upgrading via `git pull && ./bin/install.sh`, the installer will now auto-detect and rewrite the stale `localhost` value during the upgrade.

[0.2.1]: https://github.com/epick/subterradb/releases/tag/v0.2.1

## [0.2.0] — 2026-04-09

This release closes the upgrade story so future versions can ship schema changes safely.

### Added
- **Schema migrations runner** (`src/server/migrations.ts`). Reads SQL files from `db/migrations/`, tracks them in a `subterradb_migrations` table, applies pending ones in their own transactions on GUI startup via the Next.js [instrumentation hook](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation). If a migration fails, the GUI refuses to start — no half-applied schemas reaching production.
- **Versioning**. New `VERSION` file at the repo root, surfaced through `env.version` and rendered as a small footer in the GUI sidebar (`SubterraDB v0.2.0`). The version is also baked into the install banner so the operator knows exactly what they just deployed.
- **Post-install smoke test**. `bin/install.sh` now runs a battery of HTTP checks at the end of the install (GUI health, login page, Kong proxy root, plus a sample project's REST endpoint if one exists). If anything is unhealthy the installer exits non-zero with a clear error so the operator notices immediately instead of finding out later from a user complaint.
- **`POST /api/admin/restart-project-containers`** — admin-only endpoint that restarts every running per-project container in place. Companion to the auto-detect logic in `bin/install.sh`; this is the manual escape hatch for operators who skip the installer.
- **`restartAllProjectContainers()`** helper in `src/server/containers.ts`. Lists containers by the `subterradb.project_slug` label and restarts them sequentially (not parallel — too many simultaneous reconnects can spike postgres `max_connections`).
- **Security model section in the README** with threat model, two production deployment paths (reverse proxy + TLS, or VPN like Tailscale), and the minimum non-negotiables.
- **Configurable port bind interfaces**: `SUBTERRADB_BIND_GUI`, `SUBTERRADB_BIND_DB`, `SUBTERRADB_BIND_KONG_PROXY` env vars in `docker-compose.yml`. Defaults preserve current LAN-friendly behavior; production deployments set them to `127.0.0.1` and put a reverse proxy in front.
- **Strong default `POSTGRES_PASSWORD`**. `bin/install.sh` now generates a 32-character random password on fresh installs via `openssl rand`. Existing installs that still use the literal `postgres` get a clear warning with the exact rotation commands.

### Changed
- **Kong Admin API (`58001`) is now hard-bound to `127.0.0.1`** in `docker-compose.yml`. Kong admin has no native authentication and there's no legitimate use case for exposing it externally — the GUI talks to Kong over the docker network, not through the host port. This closes a critical pre-0.2.0 vulnerability where any attacker reaching `:58001` could create / delete / hijack routes. Power users who need it can still reach it via SSH tunnel.
- **`bin/install.sh` auto-detects postgres recreates** by snapshotting the postgres container ID before and after `docker compose up`. If the ID changes (compose recreated the container, e.g. after a port config change), every per-project container is automatically restarted so its connection pool refreshes against the new postgres. Pre-0.2.0 this caused a class of bug where GoTrue / Storage / Realtime would silently start returning `broken pipe` errors after an upgrade.
- **`bin/install.sh` enables `docker.service` in systemd** if not already enabled, so the stack survives host reboots without any cron job. Combined with `restart: unless-stopped` on every container.
- **`subterradb-postgres` and `subterradb-kong` got `restart: unless-stopped`** in `docker-compose.yml`. Pre-0.2.0 they would not come back after a reboot.
- **`@subterradb/mcp-server@0.1.2` published on npm**. The in-GUI MCP card now generates `npx -y --package=@subterradb/mcp-server mcp-server` snippets instead of pointing at an `/app/...` path that only existed inside the GUI container. Developers using the MCP need zero local install — the editor invokes `npx`, npm fetches the package on first run, subsequent launches use the cache.
- **`packages/mcp-server` package metadata** (repository, homepage, bugs, keywords, author) so the npmjs.com page renders properly. The bin name was renamed from `subterradb-mcp` to `mcp-server` to match the package basename for cleaner npx resolution. The README example values were changed from `localhost:58000` (which looked hardcoded) to obvious `YOUR_SUBTERRADB_HOST` placeholders, with a prominent note pointing users at the GUI's MCP card.
- **Async project provisioning**. `POST /api/projects` now returns 201 immediately (~200ms) with `status: provisioning`, then runs the long DB + 4-container + Kong sequence in the background. The new-project form redirects straight to `/projects` where a poller (`<ProjectsListPoller>`) auto-refreshes the list every 2 seconds and the badge flips from `provisioning` to `running` without the user touching anything. Pre-0.2.0 the user was stuck staring at a spinning button for 20-30 seconds.
- **Session cookies are no longer marked `Secure` by default**. Pre-0.2.0 they were `Secure` whenever `NODE_ENV=production`, which broke login over plain HTTP (browsers refuse to store Secure cookies on http://). Now controlled by `SUBTERRADB_SECURE_COOKIES` env var, default `false`. Set to `true` only when SubterraDB is behind a TLS-terminating reverse proxy.
- **GUI container can talk to the docker socket**. `bin/install.sh` detects the host's `docker` group GID via `getent group docker` and writes it to `.env` as `DOCKER_GID`; `docker-compose.yml` adds it as a supplementary group on the in-container `nextjs` user. Pre-0.2.0 this was the cause of the `EACCES /var/run/docker.sock` bug that broke project creation.
- **Lazy env validation + lazy connection pools**. `src/server/env.ts` resolves env vars via property getters instead of at module load; `src/server/db.ts` and `src/server/project-db.ts` build their `pg.Pool` on first use via `getPool()`. This is what makes `next build` work inside the Docker builder, where the build container has no `.env` present.
- **Turbopack `serverExternalPackages`** for `dockerode`, `ssh2`, `docker-modem`, `cpu-features`. Without this, Turbopack tries to bundle ssh2's native binding and the production build fails.

### Removed
- `db/init/02-subterradb-system-schema.sql`. The schema is now applied by the migration runner from `db/migrations/0001_initial_schema.sql`. Postgres `/docker-entrypoint-initdb.d` only runs `01-create-databases.sql` (which creates the empty `subterradb_system` and `kong` databases — that part can't move into the migration runner because the runner needs a database to connect to).
- `scripts/` directory. Internal screenshot helpers and smoke tests for development; not part of the public product.
- 9 of 10 dev screenshots. Only `docs/screenshots/02-dashboard.png` is shipped in the repo.

### Fixed
- `package-lock.json` rebuilt from scratch — pre-fix it was missing nested `@swc/helpers@0.5.21`, breaking `npm ci` in the Docker build.
- `language-switcher.tsx` was passing `params` to next-intl's typed router (which only accepts `pathname` or `{pathname, query}`).
- Removed dead scaffolding from `src/features/*/data/mock-*.ts` and `src/lib/supabase/*` that never got imported.
- Tracked an empty `public/.gitkeep` so the Dockerfile's `COPY public` step doesn't fail on a fresh clone.

### Security
- See the new [Security model](README.md#-security-model--read-this-before-deploying) section in the README for the full threat model and the two recommended deployment paths (reverse proxy + TLS, or VPN like Tailscale).

---

## [0.1.0] — 2026-04-08

Initial public release. Self-hosted Supabase, multi-project. Single VM hosts dozens of isolated Supabase projects with the same SDK developers already use.

### Initial features
- **Control plane**: email + password auth, two roles (admin / developer), session cookies, audit log foundation.
- **Project lifecycle**: create / stop / start / delete with one click each, ~20s to provision a fresh project.
- **Per-project containers**: PostgREST, GoTrue, Storage, Realtime — each with its own database, isolated by Postgres `CREATE DATABASE`.
- **In-GUI tools**: Monaco SQL editor with rollback-on-error, table editor with inline cell editing, auth manager, storage browser, live logs viewer, gateway dashboard.
- **MCP server**: bundled `@subterradb/mcp-server` exposing each project to Cursor / Claude Code / Windsurf via the standard Model Context Protocol.
- **Kong 3.7.1 in DB mode** with dynamic per-project route registration, `key-auth` + `cors` + `acl` + `request-transformer` plugins.
- **One-shot installer**: `bin/install.sh` boots the full stack on a fresh Debian/Ubuntu VM with only Docker + Docker Compose pre-installed.
- **Internationalization**: English + Spanish out of the box via `next-intl`, every string passes through translation.

[0.2.0]: https://github.com/epick/subterradb/releases/tag/v0.2.0
[0.1.0]: https://github.com/epick/subterradb/releases/tag/v0.1.0
