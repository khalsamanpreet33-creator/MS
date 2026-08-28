import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { config } from '../config.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';
import { HttpError } from '../lib/zodError.js';

const router = Router();
router.use(requireAuth);

// Keys the admin can edit through the UI. Anything else is system-managed
// and would require a migration to change.
const EDITABLE_KEYS = [
  'school.name',
  'school.address',
  'school.phone',
  'school.email',
  'school.academic_year',
  'currency.code',
  'currency.symbol',
] as const;

const KEYS_WITH_LIMITS: Record<string, { max: number; pattern?: RegExp }> = {
  'school.name': { max: 120 },
  'school.address': { max: 240 },
  'school.phone': { max: 32, pattern: /^[\d+\-\s()]+$/ },
  'school.email': { max: 120, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  'school.academic_year': { max: 16, pattern: /^\d{4}-\d{4}$/ },
  'currency.code': { max: 4, pattern: /^[A-Z]{3,4}$/ },
  'currency.symbol': { max: 4 },
};

const patchSchema = z.object({
  updates: z
    .array(
      z.object({
        key: z.string(),
        value: z.string().max(500),
      }),
    )
    .min(1)
    .max(EDITABLE_KEYS.length),
});

router.get('/', (_req, res) => {
  const rows = db()
    .prepare('SELECT key, value, updated_at FROM settings')
    .all() as { key: string; value: string; updated_at: string }[];

  const map: Record<string, { value: string; updated_at: string; editable: boolean }> = {};
  for (const row of rows) {
    map[row.key] = {
      value: row.value,
      updated_at: row.updated_at,
      editable: (EDITABLE_KEYS as readonly string[]).includes(row.key),
    };
  }

  // System config from env — read-only on this page.
  const system = {
    backup_retention_runs: config.backupRetention,
    system_events_retention_days: config.systemEventsRetentionDays,
    outbox_flush_interval_ms: config.outboxFlushIntervalMs,
    jwt_ttl_seconds: config.jwtTtlSeconds,
    upload_max_bytes: config.uploadMaxBytes,
  };

  res.json({ settings: map, editable_keys: EDITABLE_KEYS, system });
});

router.patch('/', requirePerm('system.admin'), (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const allowed = new Set<string>(EDITABLE_KEYS);

    const tx = db().transaction(() => {
      for (const u of body.updates) {
        if (!allowed.has(u.key)) throw new HttpError(400, 'unknown_key', u.key);
        const limits = KEYS_WITH_LIMITS[u.key];
        if (limits?.pattern && !limits.pattern.test(u.value)) {
          throw new HttpError(400, 'invalid_value', { key: u.key });
        }
        if (limits && u.value.length > limits.max) {
          throw new HttpError(400, 'value_too_long', { key: u.key, max: limits.max });
        }
        db()
          .prepare(
            `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
          )
          .run(u.key, u.value);
      }
    });
    tx();

    db()
      .prepare(
        `INSERT INTO system_events (id, level, source, message, details)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        `evt_${Date.now().toString(36)}`,
        'info',
        'settings.update',
        `Updated ${body.updates.length} setting(s)`,
        JSON.stringify(body.updates.map((u) => u.key)),
      );

    res.json({ ok: true, updated: body.updates.length });
  } catch (e) {
    next(e);
  }
});

export default router;
