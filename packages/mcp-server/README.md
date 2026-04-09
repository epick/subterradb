# @subterradb/mcp-server

Model Context Protocol server for [SubterraDB](https://github.com/epick/subterradb). Lets MCP-aware editors (Claude Code, Cursor, Windsurf, ...) talk to a local SubterraDB project so an agent can list tables, run SQL, and inspect project metadata without leaving the editor.

This MCP coexists with the official Supabase MCP — they target different environments (local vs cloud). Activate one or the other depending on whether you're developing locally against SubterraDB or against Supabase Cloud production.

## Install

```bash
npm install -g @subterradb/mcp-server
```

Or run via `npx` directly from your MCP config (no install needed).

## Configuration

> **You don't need to write this snippet by hand.** Open your project in the SubterraDB GUI and go to the **MCP Server** card on the project page — it generates the exact snippet for you with your real host, project slug, service key, and database URL pre-filled. Copy → paste into your editor's MCP config → done. The example below is just here to show the shape.

The snippet lives in your editor's MCP config file (`.cursor/mcp.json`, `.codex/mcp.json`, `claude_desktop_config.json`, etc.):

```json
{
  "mcpServers": {
    "subterradb-MY_PROJECT": {
      "command": "npx",
      "args": ["-y", "--package=@subterradb/mcp-server", "mcp-server"],
      "env": {
        "SUBTERRADB_URL": "http://YOUR_SUBTERRADB_HOST:58000/MY_PROJECT",
        "SUBTERRADB_SERVICE_KEY": "<service_role JWT from the GUI>",
        "SUBTERRADB_DB_URL": "postgresql://postgres:postgres@YOUR_SUBTERRADB_HOST:55432/proj_MY_PROJECT"
      }
    }
  }
}
```

Replace:

- `YOUR_SUBTERRADB_HOST` → the IP or hostname of the machine where SubterraDB is running (`10.0.0.42`, `subterra.example.com`, etc.). **Not** `localhost` unless your editor and SubterraDB are on the same machine.
- `MY_PROJECT` → the slug of the project as shown in the GUI.
- `<service_role JWT from the GUI>` → copy from the project's Connection card.

The package itself stores **no URLs internally**. Every value comes from these env vars at runtime.

| Env var | Required | Description |
|---|---|---|
| `SUBTERRADB_URL` | ✅ | The full gateway URL for the project, including the slug. Get it from the project's Connection Details card in SubterraDB GUI. |
| `SUBTERRADB_SERVICE_KEY` | ✅ | The project's `service_role` key. |
| `SUBTERRADB_DB_URL` | optional | Direct Postgres connection string. Required for `list_tables` and `execute_sql` (those tools introspect the database directly). |

### Coexisting with the official Supabase MCP

This package and `@supabase/mcp-server-supabase` can live in the same MCP config — they target different environments (local SubterraDB vs Supabase Cloud). Just declare both server entries:

```json
{
  "mcpServers": {
    "subterradb-MY_PROJECT": { /* ...as above... */ },
    "supabase-cloud": {
      "command": "npx",
      "args": ["-y", "--package=@supabase/mcp-server-supabase", "mcp-server-supabase"],
      "env": {
        "SUPABASE_URL": "https://YOUR_PROJECT.supabase.co",
        "SUPABASE_SERVICE_KEY": "<service_role JWT from supabase.com>"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|---|---|
| `get_project_info` | Returns gateway URL + REST/Auth/Storage/Realtime endpoints for the project. |
| `list_tables` | Lists every table in the project's public schema with row counts. Requires `SUBTERRADB_DB_URL`. |
| `execute_sql` | Runs an arbitrary SQL query. Requires `SUBTERRADB_DB_URL`. **Use sparingly — destructive statements run immediately.** |
| `list_users` | Lists users from the project's GoTrue auth schema. |

Tool names intentionally mirror the official Supabase MCP where possible so switching between local and cloud development is as friction-free as possible.

## Develop

```bash
npm install
npm run build
npm start
```

## License

MIT
