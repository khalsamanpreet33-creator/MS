import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  audience: string;
  is_holiday: number;
  created_by_name: string | null;
  rsvp_count: number;
}

const eventSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(['academic', 'sports', 'cultural', 'holiday', 'meeting', 'general']).default('general'),
  start_date: z.string().min(8),
  end_date: z.string().nullable().optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  location: z.string().max(160).nullable().optional(),
  audience: z.enum(['all', 'students', 'staff', 'parents']).default('all'),
  is_holiday: z.boolean().default(false),
});

router.get('/', requirePerm('events.read'), (req, res) => {
  const start = typeof req.query.start === 'string' ? req.query.start : '';
  const end = typeof req.query.end === 'string' ? req.query.end : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (start) { where.push('e.start_date >= ?'); params.push(start); }
  if (end) { where.push('(e.end_date IS NULL OR e.start_date <= ?)'); params.push(end); }
  if (category) { where.push('e.category = ?'); params.push(category); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT e.*, u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.response = 'yes') AS rsvp_count
         FROM events e
         LEFT JOIN users u ON u.id = e.created_by
         ${clause}
         ORDER BY e.start_date ASC, e.start_time ASC`,
    )
    .all(...params) as EventRow[];
  res.json({ items: rows });
});

router.post('/', requirePerm('events.write'), (req, res, next) => {
  try {
    const body = eventSchema.parse(req.body);
    const newId = id('evt');
    db()
      .prepare(
        `INSERT INTO events (id, title, description, category, start_date, end_date, start_time, end_time, location, audience, is_holiday, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.title, body.description ?? null, body.category, body.start_date,
           body.end_date ?? null, body.start_time ?? null, body.end_time ?? null,
           body.location ?? null, body.audience, body.is_holiday ? 1 : 0, req.user!.id);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('events.write'), (req, res, next) => {
  try {
    const body = eventSchema.partial().parse(req.body);
    const exists = db().prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'event_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      title: 'title', description: 'description', category: 'category',
      start_date: 'start_date', end_date: 'end_date', start_time: 'start_time',
      end_time: 'end_time', location: 'location', audience: 'audience',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k] === '' ? null : (body as Record<string, unknown>)[k]);
      }
    }
    if (body.is_holiday !== undefined) {
      fields.push('is_holiday = ?');
      params.push(body.is_holiday ? 1 : 0);
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push('updated_at = datetime(\'now\')');
    db().prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('events.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'event_not_found');
  db().prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// RSVPs
const rsvpSchema = z.object({
  response: z.enum(['yes', 'no', 'maybe']),
});

router.post('/:id/rsvp', requirePerm('events.read'), (req, res, next) => {
  try {
    const body = rsvpSchema.parse(req.body);
    const exists = db().prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'event_not_found');
    const newId = id('rsv');
    db()
      .prepare(
        `INSERT INTO event_rsvps (id, event_id, user_id, response) VALUES (?, ?, ?, ?)
         ON CONFLICT(event_id, user_id) DO UPDATE SET response = excluded.response, responded_at = datetime('now')`,
      )
      .run(newId, req.params.id, req.user!.id, body.response);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;