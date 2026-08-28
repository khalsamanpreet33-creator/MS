import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';
import { HttpError } from '../lib/zodError.js';

const router = Router();
router.use(requireAuth);
router.use(requirePerm('audit.read'));

// Schema reused by /, /csv and the SPA filters.
const querySchema = z.object({
  actor_id: z.string().optional(),
  method: z.string().optional(),
  route_contains: z.string().optional(),
  status: z.coerce.number().int().optional(),
  status_class: z.enum(['2xx', '3xx', '4xx', '5xx']).optional(),
  from: z.string().optional(), // ISO datetime
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function buildWhere(q: z.infer<typeof querySchema>): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (q.actor_id) { parts.push('al.actor_id = ?'); params.push(q.actor_id); }
  if (q.method) { parts.push('al.method = ?'); params.push(q.method.toUpperCase()); }
  if (q.route_contains) { parts.push('al.route LIKE ?'); params.push(`%${q.route_contains}%`); }
  if (q.status !== undefined) { parts.push('al.status = ?'); params.push(q.status); }
  if (q.status_class) {
    const lo = q.status_class[0] + '00';
    const hi = q.status_class[0] + '99';
    parts.push('al.status BETWEEN ? AND ?');
    params.push(Number(lo), Number(hi));
  }
  if (q.from) { parts.push('al.created_at >= ?'); params.push(q.from); }
  if (q.to) { parts.push('al.created_at <= ?'); params.push(q.to); }
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

router.get('/', (req, res, next) => {
  try {
    const q = querySchema.parse(req.query);
    const { sql, params } = buildWhere(q);
    const rows = db()
      .prepare(
        `SELECT al.id, al.actor_id, u.username, u.full_name,
                al.route, al.method, al.status, al.ip, al.created_at
           FROM audit_log al
           LEFT JOIN users u ON u.id = al.actor_id
           ${sql}
           ORDER BY al.created_at DESC
           LIMIT ? OFFSET ?`,
      )
      .all(...params, q.limit, q.offset);
    const total = (db()
      .prepare(
        `SELECT COUNT(*) AS n FROM audit_log al ${sql}`,
      )
      .get(...params) as { n: number }).n;
    res.json({ items: rows, total, limit: q.limit, offset: q.offset });
  } catch (e) {
    if (e instanceof z.ZodError) {
      next(new HttpError(400, 'invalid_query', e.errors));
      return;
    }
    next(e);
  }
});

router.get('/actors', (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT DISTINCT u.id, u.username, u.full_name
         FROM audit_log al
         JOIN users u ON u.id = al.actor_id
         WHERE al.actor_id IS NOT NULL
         ORDER BY u.full_name`,
    )
    .all();
  res.json({ items: rows });
});

router.get('/csv', (req, res, next) => {
  try {
    const q = querySchema.parse(req.query);
    // CSV export ignores pagination and caps at 5000 rows.
    const limit = Math.min(q.limit * 10, 5000);
    const { sql, params } = buildWhere(q);
    const rows = db()
      .prepare(
        `SELECT al.created_at, u.username AS actor_username, al.method, al.route,
                al.status, al.ip, al.payload_hash
           FROM audit_log al
           LEFT JOIN users u ON u.id = al.actor_id
           ${sql}
           ORDER BY al.created_at DESC
           LIMIT ?`,
      )
      .all(...params, limit) as Record<string, unknown>[];

    const header = ['created_at', 'actor_username', 'method', 'route', 'status', 'ip', 'payload_hash'];
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header.join(',')]
      .concat(rows.map((r) => header.map((h) => esc(r[h])).join(',')))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

export default router;
