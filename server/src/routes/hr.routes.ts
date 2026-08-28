import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface AppRow {
  id: string;
  user_id: string;
  user_name: string;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name: string;
  leave_type_color: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_id: string | null;
  approver_name: string | null;
  decision_at: string | null;
  decision_notes: string | null;
  created_at: string;
}

interface LeaveType {
  id: string;
  code: string;
  name: string;
  days_per_year: number;
  color: string;
  status: 'active' | 'inactive';
}

interface Balance {
  leave_type_id: string;
  code: string;
  name: string;
  color: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  available: number;
}

function computeDays(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

// Leave types
router.get('/leave-types', requirePerm('hr.read'), (_req, res) => {
  const rows = db()
    .prepare('SELECT * FROM leave_types ORDER BY name')
    .all() as LeaveType[];
  res.json({ items: rows });
});

// Balances for a user (defaults to current user)
router.get('/balances', requirePerm('hr.read'), (req, res) => {
  const userId = typeof req.query.userId === 'string' && req.query.userId
    ? req.query.userId
    : req.user!.id;
  const year = Number(req.query.year) || new Date().getFullYear();

  const types = db()
    .prepare('SELECT * FROM leave_types WHERE status = ? ORDER BY name')
    .all('active') as LeaveType[];

  const result: Balance[] = types.map((t) => {
    const bal = db()
      .prepare('SELECT total_days, used_days FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?')
      .get(userId, t.id, year) as { total_days: number; used_days: number } | undefined;
    const pending = (db()
      .prepare(`SELECT COALESCE(SUM(days), 0) AS p FROM leave_applications WHERE user_id = ? AND leave_type_id = ? AND status = 'pending' AND strftime('%Y', from_date) = ?`)
      .get(userId, t.id, String(year)) as { p: number }).p;
    const total = bal?.total_days ?? t.days_per_year;
    const used = bal?.used_days ?? 0;
    return {
      leave_type_id: t.id,
      code: t.code,
      name: t.name,
      color: t.color,
      total_days: total,
      used_days: used,
      pending_days: pending,
      available: Math.max(0, total - used - pending),
    };
  });

  res.json({ items: result, year });
});

// List applications (filterable)
router.get('/applications', requirePerm('hr.read'), (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
  const year = typeof req.query.year === 'string' ? req.query.year : '';

  const where: string[] = [];
  const params: unknown[] = [];
  if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
    where.push('la.status = ?');
    params.push(status);
  }
  if (userId) {
    where.push('la.user_id = ?');
    params.push(userId);
  }
  if (year) {
    where.push("strftime('%Y', la.from_date) = ?");
    params.push(year);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db()
    .prepare(
      `SELECT la.*, u.full_name AS user_name,
              lt.code AS leave_type_code, lt.name AS leave_type_name, lt.color AS leave_type_color,
              ap.full_name AS approver_name
         FROM leave_applications la
         JOIN users u ON u.id = la.user_id
         JOIN leave_types lt ON lt.id = la.leave_type_id
         LEFT JOIN users ap ON ap.id = la.approver_id
         ${clause}
         ORDER BY la.created_at DESC LIMIT 500`,
    )
    .all(...params) as AppRow[];
  res.json({ items: rows });
});

const applySchema = z.object({
  leave_type_id: z.string().min(1),
  from_date: z.string().min(8),
  to_date: z.string().min(8),
  reason: z.string().max(1000).nullable().optional(),
});

router.post('/applications', requirePerm('leave.apply'), (req, res, next) => {
  try {
    const body = applySchema.parse(req.body);
    const days = computeDays(body.from_date, body.to_date);
    if (days <= 0) throw new HttpError(400, 'invalid_date_range');

    const lt = db().prepare('SELECT id FROM leave_types WHERE id = ? AND status = ?').get(body.leave_type_id, 'active');
    if (!lt) throw new HttpError(404, 'leave_type_not_found');

    const newId = id('lapp');
    db()
      .prepare(
        `INSERT INTO leave_applications (id, user_id, leave_type_id, from_date, to_date, days, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      )
      .run(newId, req.user!.id, body.leave_type_id, body.from_date, body.to_date, days, body.reason ?? null);

    const row = db().prepare('SELECT id, user_id, leave_type_id, from_date, to_date, days, reason, status, created_at FROM leave_applications WHERE id = ?').get(newId);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

const decisionSchema = z.object({
  notes: z.string().max(500).nullable().optional(),
});

router.patch('/applications/:id/approve', requirePerm('hr.approve'), (req, res, next) => {
  try {
    decisionSchema.parse(req.body ?? {});
    const app = db().prepare('SELECT id, status FROM leave_applications WHERE id = ?').get(req.params.id) as { id: string; status: string } | undefined;
    if (!app) throw new HttpError(404, 'application_not_found');
    if (app.status !== 'pending') throw new HttpError(400, 'already_decided');

    const body = (req.body ?? {}) as { notes?: string | null };
    db()
      .prepare(
        `UPDATE leave_applications SET status = 'approved', approver_id = ?, decision_at = datetime('now'), decision_notes = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(req.user!.id, body.notes ?? null, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch('/applications/:id/reject', requirePerm('hr.approve'), (req, res, next) => {
  try {
    decisionSchema.parse(req.body ?? {});
    const app = db().prepare('SELECT id, status FROM leave_applications WHERE id = ?').get(req.params.id) as { id: string; status: string } | undefined;
    if (!app) throw new HttpError(404, 'application_not_found');
    if (app.status !== 'pending') throw new HttpError(400, 'already_decided');

    const body = (req.body ?? {}) as { notes?: string | null };
    db()
      .prepare(
        `UPDATE leave_applications SET status = 'rejected', approver_id = ?, decision_at = datetime('now'), decision_notes = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(req.user!.id, body.notes ?? null, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch('/applications/:id/cancel', requirePerm('leave.apply'), (req, res) => {
  const app = db().prepare('SELECT id, user_id, status FROM leave_applications WHERE id = ?').get(req.params.id) as { id: string; user_id: string; status: string } | undefined;
  if (!app) throw new HttpError(404, 'application_not_found');
  if (app.user_id !== req.user!.id) throw new HttpError(403, 'not_your_application');
  if (app.status !== 'pending') throw new HttpError(400, 'already_decided');
  db().prepare(`UPDATE leave_applications SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// Holidays
const holidaySchema = z.object({
  date: z.string().min(8),
  name: z.string().min(1).max(120),
  type: z.enum(['public', 'school', 'optional']).default('public'),
});

router.get('/holidays', requirePerm('hr.read'), (req, res) => {
  const year = typeof req.query.year === 'string' ? req.query.year : '';
  const where = year ? `WHERE strftime('%Y', date) = ?` : '';
  const rows = db()
    .prepare(`SELECT id, date, name, type FROM holidays ${where} ORDER BY date`)
    .all(...(year ? [year] : []));
  res.json({ items: rows });
});

router.post('/holidays', requirePerm('hr.write'), (req, res, next) => {
  try {
    const body = holidaySchema.parse(req.body);
    const newId = id('hol');
    try {
      db()
        .prepare('INSERT INTO holidays (id, date, name, type) VALUES (?, ?, ?, ?)')
        .run(newId, body.date, body.name, body.type);
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'duplicate_date');
      throw e;
    }
    const row = db().prepare('SELECT id, date, name, type FROM holidays WHERE id = ?').get(newId);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

router.delete('/holidays/:id', requirePerm('hr.delete'), (req, res) => {
  const existing = db().prepare('SELECT id FROM holidays WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'holiday_not_found');
  db().prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
