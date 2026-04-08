#!/usr/bin/env node
//
// @subterradb/mcp-server
//
// Model Context Protocol server for SubterraDB. Connects MCP-aware editors
// (Claude Code, Cursor, Windsurf, etc.) to a local SubterraDB project so the
// agent can list tables, run queries, and inspect project metadata without
// leaving the editor.
//
// Configuration (via env vars):
//
//   SUBTERRADB_URL          http://localhost:58000/<slug>     (gateway URL)
//   SUBTERRADB_SERVICE_KEY  eyJhbGciOiJIUzI1NiJ9...           (service_role)
//   SUBTERRADB_DB_URL       postgresql://...                  (optional, for SQL)
//
// This MCP coexists with the official Supabase MCP — they target different
// environments (local vs cloud). Tool names mirror the Supabase MCP where
// possible to minimize friction when switching between them.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import pg from 'pg';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const env = {
  url: process.env.SUBTERRADB_URL ?? '',
  serviceKey: process.env.SUBTERRADB_SERVICE_KEY ?? '',
  dbUrl: process.env.SUBTERRADB_DB_URL ?? '',
};

if (!env.url || !env.serviceKey) {
  console.error(
    '[subterradb-mcp] Missing SUBTERRADB_URL or SUBTERRADB_SERVICE_KEY env vars.\n' +
      'Set them in your MCP config (see https://github.com/subterradb/mcp-server#configuration).',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helper: SDK-like fetch wrapper around the project's gateway
// ---------------------------------------------------------------------------

async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${env.url}${path}`, {
    ...init,
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: 'get_project_info',
    description:
      'Returns connection metadata for the current SubterraDB project — gateway URL, REST endpoint, available services.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_tables',
    description:
      'Lists every table in the project\'s public schema with row counts and column counts. Read-only.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'execute_sql',
    description:
      'Runs an arbitrary SQL query against the project\'s database. Requires SUBTERRADB_DB_URL to be set in the MCP config. Use sparingly — destructive statements (DELETE, UPDATE, DROP) execute immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL statement to execute.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_users',
    description:
      'Lists every user in the project\'s GoTrue auth schema. Read-only.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolGetProjectInfo() {
  return {
    gatewayUrl: env.url,
    restUrl: `${env.url}/rest/v1`,
    authUrl: `${env.url}/auth/v1`,
    storageUrl: `${env.url}/storage/v1`,
    realtimeUrl: `${env.url}/realtime/v1`,
    hasDirectDbAccess: env.dbUrl.length > 0,
  };
}

async function toolListTables() {
  if (!env.dbUrl) {
    throw new Error(
      'list_tables requires SUBTERRADB_DB_URL in the MCP config so the server can introspect the project database directly.',
    );
  }
  const client = new pg.Client({ connectionString: env.dbUrl });
  await client.connect();
  try {
    const r = await client.query<{
      schema: string;
      name: string;
      reltuples: string;
      column_count: string;
    }>(`
      SELECT
        n.nspname AS schema,
        c.relname AS name,
        c.reltuples::bigint::text AS reltuples,
        (SELECT count(*)::text FROM information_schema.columns
          WHERE table_schema = n.nspname AND table_name = c.relname) AS column_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
      ORDER BY c.relname
    `);
    return {
      tables: r.rows.map((row) => ({
        schema: row.schema,
        name: row.name,
        approximateRowCount: Math.max(0, Number(row.reltuples)),
        columnCount: Number(row.column_count),
      })),
    };
  } finally {
    await client.end();
  }
}

async function toolExecuteSql(query: string) {
  if (!env.dbUrl) {
    throw new Error(
      'execute_sql requires SUBTERRADB_DB_URL in the MCP config so the server can run queries directly.',
    );
  }
  const client = new pg.Client({ connectionString: env.dbUrl });
  await client.connect();
  const start = Date.now();
  try {
    const result = await client.query(query);
    return {
      columns: (result.fields ?? []).map((f) => f.name),
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
      durationMs: Date.now() - start,
    };
  } finally {
    await client.end();
  }
}

async function toolListUsers() {
  // Use the gateway's auth admin endpoint via the service_role key.
  const res = await gatewayFetch('/auth/v1/admin/users');
  if (!res.ok) {
    throw new Error(`auth admin returned ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}

// ---------------------------------------------------------------------------
// MCP server bootstrap
// ---------------------------------------------------------------------------

const server = new Server(
  {
    name: 'subterradb-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: unknown;
    switch (name) {
      case 'get_project_info':
        result = await toolGetProjectInfo();
        break;
      case 'list_tables':
        result = await toolListTables();
        break;
      case 'execute_sql':
        if (typeof args?.query !== 'string') {
          throw new Error('execute_sql: `query` argument is required and must be a string');
        }
        result = await toolExecuteSql(args.query);
        break;
      case 'list_users':
        result = await toolListUsers();
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: 'text', text: message }],
    };
  }
});

// ---------------------------------------------------------------------------
// Connect over stdio (the standard MCP transport for editor integrations)
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);

// eslint-disable-next-line no-console
console.error('[subterradb-mcp] ready (gateway:', env.url, ')');
