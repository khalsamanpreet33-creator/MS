import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';

export interface BackupResult {
  dbFile: string | null;
  dataZip: string | null;
  totalBytes: number;
  errors: string[];
}

export async function runBackup(): Promise<BackupResult> {
  const result: BackupResult = { dbFile: null, dataZip: null, totalBytes: 0, errors: [] };
  if (!fs.existsSync(config.backupsDir)) fs.mkdirSync(config.backupsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13); // YYYYMMDDHHmm

  // 1. Snapshot the database file (use SQLite backup API)
  try {
    const dest = path.join(config.backupsDir, `db-${stamp}.db`);
    const src = db();
    const sql = src.prepare('VACUUM INTO ?').bind(dest);
    // VACUUM INTO isn't available in better-sqlite3 directly; use serialize/deserialize
    const data = src.serialize?.();
    if (data instanceof Buffer) {
      fs.writeFileSync(dest, data);
    } else {
      // fallback: copy via exec checkpoint + read
      const buf = src.pragma('wal_checkpoint(FULL)');
      const fileBuf = fs.readFileSync(config.dbPath);
      fs.writeFileSync(dest, fileBuf);
    }
    result.dbFile = dest;
    result.totalBytes += fs.statSync(dest).size;
  } catch (e) {
    result.errors.push(`db_backup: ${(e as Error).message}`);
  }

  // 2. Zip school-data/
  try {
    if (fs.existsSync(config.schoolDataDir)) {
      const items = fs.readdirSync(config.schoolDataDir);
      if (items.length) {
        const zipPath = path.join(config.backupsDir, `data-${stamp}.zip`);
        await new Promise<void>((resolve, reject) => {
          const output = fs.createWriteStream(zipPath);
          const archive = archiver('zip', { zlib: { level: 6 } });
          output.on('close', () => resolve());
          archive.on('error', reject);
          archive.pipe(output);
          archive.directory(config.schoolDataDir, false);
          archive.finalize();
        });
        result.dataZip = zipPath;
        result.totalBytes += fs.statSync(zipPath).size;
      }
    }
  } catch (e) {
    result.errors.push(`data_zip: ${(e as Error).message}`);
  }

  // 3. Retention: delete old backups
  try {
    const all = fs
      .readdirSync(config.backupsDir)
      .filter((f) => f.startsWith('db-') || f.startsWith('data-'))
      .map((f) => ({ f, m: fs.statSync(path.join(config.backupsDir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    if (all.length > config.backupRetention * 2) {
      for (const old of all.slice(config.backupRetention * 2)) {
        try {
          fs.unlinkSync(path.join(config.backupsDir, old.f));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore retention errors */
  }

  // 4. Record event
  try {
    db()
      .prepare(
        `INSERT INTO system_events (id, level, source, message, details)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        id('evt'),
        result.errors.length ? 'warning' : 'info',
        'backup',
        result.errors.length
          ? `Backup completed with ${result.errors.length} error(s)`
          : `Backup complete: ${(result.totalBytes / 1024).toFixed(1)} KB`,
        JSON.stringify(result),
      );
  } catch {
    /* ignore */
  }

  return result;
}