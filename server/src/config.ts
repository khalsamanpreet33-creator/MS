import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

export const config = {
  root: ROOT,
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production',
  jwtTtlSeconds: Number(process.env.JWT_TTL ?? 60 * 60 * 12), // 12h
  dbPath: process.env.DB_PATH ?? path.join(ROOT, 'server', 'data', 'school.db'),
  schoolDataDir: process.env.SCHOOL_DATA_DIR ?? path.join(ROOT, 'school-data'),
  backupsDir: process.env.BACKUPS_DIR ?? path.join(ROOT, 'backups'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  backupRetention: Number(process.env.BACKUP_RETENTION ?? 14),
  outboxFlushIntervalMs: Number(process.env.OUTBOX_FLUSH_MS ?? 30_000),
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024),
  systemEventsRetentionDays: Number(process.env.SYSTEM_EVENTS_RETENTION_DAYS ?? 90),
};

export function ensureDirs(): void {
  for (const dir of [config.schoolDataDir, config.backupsDir, path.dirname(config.dbPath)]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}