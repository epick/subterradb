# @subterradb/mcp-server

Model Context Protocol server for [SubterraDB](https://github.com/epick/subterradb). Lets MCP-aware editors (Claude Code, Cursor, Windsurf, ...) talk to a local SubterraDB project so an agent can list tables, run SQL, and inspect project metadata without leaving the editor.

This MCP coexists with the official Supabase MCP — they target different environments (local vs cloud). Activate one or the other depending on whether you're developing locally against SubterraDB or against Supabase Cloud production.

## Install

```bash
npm install -g @subterradb/mcp-server
```

Or run via `npx` directly from your MCP config (no install needed).

## Configuration

In your editor's MCP config file (`.cursor/mcp.json`, `.codex/mcp.json`, `claude_desktop_config.json`, etc.):

```json
{
  "mcpServers": {
    "subterradb-local": {
      "command": "npx",
      "args": ["-y", "@subterradb/mcp-server@latest"],
      "env": {
        "SUBTERRADB_URL": "http://localhost:58000/my-app",
        "SUBTERRADB_SERVICE_KEY": "eyJhbGciOi...",
        "SUBTERRADB_DB_URL": "postgresql://postgres:postgres@localhost:55432/proj_my_app"
      }
    },
    "supabase-cloud": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_URL": "https://xyz.supabase.co",
        "SUPABASE_SERVICE_KEY": "eyJhbGc..."
      }
    }
  }
}
```

| Env var | Required | Description |
|---|---|---|
| `SUBTERRADB_URL` | ✅ | The full gateway URL for the project, including the slug. Get it from the project's Connection Details card in SubterraDB GUI. |
| `SUBTERRADB_SERVICE_KEY` | ✅ | The project's `service_role` key. |
| `SUBTERRADB_DB_URL` | optional | Direct Postgres connection string. Required for `list_tables` and `execute_sql` (those tools introspect the database directly). |

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
