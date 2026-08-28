import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';
import { runBackup, type BackupResult } from '../jobs/backup.job.js';
import { bus, broadcastChannel } from '../lib/sse.js';

const router = Router();
router.use(requireAuth);
router.use(requirePerm('system.admin'));

interface BackupFile {
  filename: string;
  kind: 'db' | 'data';
  size_bytes: number;
  modified_at: string;
}

// Filenames are produced by the backup job as `db-YYYYMMDDHHmm.db` or
// `data-YYYYMMDDHHmm.zip`. Strict regex stops path-traversal attempts and
// never trusts the raw query string.
function safeList(): BackupFile[] {
  if (!fs.existsSync(config.backupsDir)) return [];
  return fs
    .readdirSync(config.backupsDir)
    .filter((f) => /^(db|data)-[\d]+\.(db|zip)$/.test(f))
    .map((f) => {
      const full = path.join(config.backupsDir, f);
      const stat = fs.statSync(full);
      return {
        filename: f,
        kind: f.startsWith('db-') ? 'db' : 'data',
        size_bytes: stat.size,
        modified_at: stat.mtime.toISOString(),
      } satisfies BackupFile;
    })
    .sort((a, b) => b.modified_at.localeCompare(a.modified_at));
}

router.get('/', (_req, res) => {
  res.json({ items: safeList(), backups_dir: config.backupsDir, retention: config.backupRetention });
});

router.post('/', async (_req, res, next) => {
  try {
    const result: BackupResult = await runBackup();
    bus.publish(broadcastChannel(), { type: 'backup.completed', result });
    res.json({ ok: true, result });
  } catch (e) {
    next(e);
  }
});

const restoreSchema = z.object({
  confirm: z.literal('RESTORE'),
  kind: z.enum(['db', 'data']).optional(),
});

router.post('/:filename/restore', (req, res, next) => {
  try {
    const { filename } = req.params;
    const body = restoreSchema.parse(req.body);

    if (!/^(db|data)-[\d]+\.(db|zip)$/.test(filename)) {
      throw new HttpError(400, 'bad_filename');
    }
    const src = path.join(config.backupsDir, filename);
    if (!fs.existsSync(src)) throw new HttpError(404, 'backup_not_found');

    const kind = body.kind ?? (filename.startsWith('db-') ? 'db' : 'data');

    if (kind === 'db') {
      // The SQLite handle is currently open on the live file; replacing the
      // file under it works on POSIX (writes go to the open inode), but the
      // server needs a restart to pick up the new contents. We copy the
      // backup to dbPath and warn the caller.
      fs.copyFileSync(src, config.dbPath);
    } else {
      // school-data restore: best-effort — copy contents of zip via unzip
      // equivalent. Without a zip lib wired in, instruct operator to unzip
      // manually after backup is verified.
      throw new HttpError(
        501,
        'data_restore_unsupported',
        'Restore school-data zip via the operator script (see README). DB restore is supported.',
      );
    }

    db()
      .prepare(
        `INSERT INTO system_events (id, level, source, message, details)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        id('evt'),
        'warning',
        'backup.restore',
        `Restored ${filename} by ${req.user?.id ?? 'unknown'}. Server restart required.`,
        JSON.stringify({ filename, kind, restored_at: new Date().toISOString() }),
      );

    res.json({ ok: true, filename, kind, restart_required: kind === 'db' });
  } catch (e) {
    if (e instanceof z.ZodError) {
      next(new HttpError(400, 'confirmation_required', 'Send { confirm: "RESTORE" } to proceed.'));
      return;
    }
    next(e);
  }
});

router.get('/:filename/download', (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!/^(db|data)-[\d]+\.(db|zip)$/.test(filename)) {
      throw new HttpError(400, 'bad_filename');
    }
    const src = path.join(config.backupsDir, filename);
    if (!fs.existsSync(src)) throw new HttpError(404, 'backup_not_found');
    res.download(src, filename);
  } catch (e) {
    next(e);
  }
});

export default router;
