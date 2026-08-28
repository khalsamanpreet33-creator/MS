import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, 'migrations');

export function runMigrations(): { applied: string[] } {
  const conn = db();
  conn.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (!fs.existsSync(migrationsDir)) {
    return { applied: [] };
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];
  const isApplied = (v: string) =>
    conn.prepare('SELECT 1 FROM _migrations WHERE version = ?').get(v);

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (isApplied(version)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const tx = conn.transaction(() => {
      conn.exec(sql);
      conn.prepare('INSERT INTO _migrations (version) VALUES (?)').run(version);
    });
    tx();
    applied.push(version);
    console.log(`[migrate] applied ${version}`);
  }
  return { applied };
}

// Allow `tsx src/db/migrate.ts` invocation
const isDirect =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('migrate.ts');

if (isDirect) {
  try {
    runMigrations();
    console.log('[migrate] done');
  } catch (e) {
    console.error('[migrate] failed:', e);
    process.exit(1);
  }
}