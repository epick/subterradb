// Schema migrations runner.
//
// Reads SQL files from db/migrations/, compares against the
// `subterradb_migrations` tracking table, and applies any pending ones in
// alphabetical order. Each migration runs in its own transaction so a
// failure aborts only that migration (and the loop), leaving previously
// successful migrations recorded as applied.
//
// Conventions for new migrations:
//   - File name format: NNNN_short_description.sql
//   - NNNN is a zero-padded sequential integer (0001, 0002, ...)
//   - Use IF NOT EXISTS / DO $$ guards everywhere so re-running is a no-op
//   - One transaction per file (the runner already wraps in withTransaction)
//   - Never edit a migration after it has been released — write a new one
//
// The runner is invoked from src/instrumentation.ts at server start, BEFORE
// the GUI accepts any HTTP traffic. If migrations fail, the process crashes
// and Next.js refuses to start — better to fail loud than serve requests
// against an inconsistent schema.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { withTransaction } from './db';

// process.cwd() is /app inside the production Docker image (where the
// Dockerfile copies db/migrations/), and the repo root in dev. Both work.
const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

export interface MigrationsResult {
  applied: string[];
  skipped: string[];
}

async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS subterradb_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function listAppliedMigrations(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ filename: string }>(
    `SELECT filename FROM subterradb_migrations`,
  );
  return new Set(r.rows.map((row) => row.filename));
}

async function listMigrationFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    // Alphabetical sort matches the NNNN_name.sql convention.
    return entries.filter((e) => e.endsWith('.sql')).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // No migrations dir at all — that's fine, nothing to apply.
      return [];
    }
    throw err;
  }
}

export async function runMigrations(): Promise<MigrationsResult> {
  const files = await listMigrationFiles();
  if (files.length === 0) {
    return { applied: [], skipped: [] };
  }

  // Step 1: ensure the tracking table exists, in its own transaction so it
  // commits regardless of what happens to the migration loop below.
  await withTransaction(async (client) => {
    await ensureMigrationsTable(client);
  });

  // Step 2: figure out what's already applied.
  const alreadyApplied = await withTransaction(async (client) => {
    return listAppliedMigrations(client);
  });

  const applied: string[] = [];
  const skipped: string[] = [];

  // Step 3: apply each pending migration in its own transaction. If one
  // fails, the loop throws and the caller (instrumentation.ts) crashes the
  // process. Previously-applied migrations stay recorded.
  for (const file of files) {
    if (alreadyApplied.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await withTransaction(async (client) => {
        await client.query(sql);
        await client.query(
          `INSERT INTO subterradb_migrations (filename) VALUES ($1)`,
          [file],
        );
      });
      applied.push(file);
    } catch (err) {
      throw new Error(
        `Migration ${file} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return { applied, skipped };
}
