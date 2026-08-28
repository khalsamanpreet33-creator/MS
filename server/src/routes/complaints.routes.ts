import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface ComplaintRow {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  raised_by: string;
  raised_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  related_to: string | null;
  related_id: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function nextTicket(): string {
  const row = db().prepare('SELECT COUNT(*) AS n FROM complaints').get() as { n: number };
  return `CMP-${(row.n + 1).toString().padStart(5, '0')}`;
}

const complaintSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(4000),
  category: z.enum(['general', 'academic', 'transport', 'facility', 'staff', 'safety', 'other']).default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assigned_to: z.string().nullable().optional(),
  related_to: z.string().max(40).nullable().optional(),
  related_id: z.string().nullable().optional(),
});

router.get('/', requirePerm('complaints.read'), (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const mine = req.query.mine === '1';
  const assigned = req.query.assigned === '1';
  const where: string[] = [];
  const params: unknown[] = [];
  if (status) { where.push('c.status = ?'); params.push(status); }
  if (mine) { where.push('c.raised_by = ?'); params.push(req.user!.id); }
  if (assigned) { where.push('c.assigned_to = ?'); params.push(req.user!.id); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT c.*, ur.full_name AS raised_by_name, ua.full_name AS assigned_to_name
         FROM complaints c
         JOIN users ur ON ur.id = c.raised_by
         LEFT JOIN users ua ON ua.id = c.assigned_to
         ${clause}
         ORDER BY
           CASE c.status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'resolved' THEN 3 ELSE 4 END,
           CASE c.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
           c.created_at DESC`,
    )
    .all(...params) as ComplaintRow[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('complaints.read'), (req, res, next) => {
  try {
    const row = db()
      .prepare(
        `SELECT c.*, ur.full_name AS raised_by_name, ua.full_name AS assigned_to_name
           FROM complaints c
           JOIN users ur ON ur.id = c.raised_by
           LEFT JOIN users ua ON ua.id = c.assigned_to
           WHERE c.id = ?`,
      )
      .get(req.params.id) as ComplaintRow | undefined;
    if (!row) throw new HttpError(404, 'complaint_not_found');
    const comments = db()
      .prepare(
        `SELECT cm.*, u.full_name AS author_name FROM complaint_comments cm
           JOIN users u ON u.id = cm.author_id
           WHERE cm.complaint_id = ? ORDER BY cm.created_at ASC`,
      )
      .all(req.params.id);
    res.json({ ...row, comments });
  } catch (e) { next(e); }
});

router.post('/', requirePerm('complaints.write'), (req, res, next) => {
  try {
    const body = complaintSchema.parse(req.body);
    const newId = id('cmp');
    const ticketNumber = nextTicket();
    db()
      .prepare(
        `INSERT INTO complaints (id, ticket_number, title, description, category, priority, raised_by, assigned_to, related_to, related_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, ticketNumber, body.title, body.description, body.category, body.priority,
           req.user!.id, body.assigned_to ?? null, body.related_to ?? null, body.related_id ?? null);
    res.status(201).json({ id: newId, ticket_number: ticketNumber });
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().min(1).max(4000).optional(),
  category: z.enum(['general', 'academic', 'transport', 'facility', 'staff', 'safety', 'other']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'rejected']).optional(),
  assigned_to: z.string().nullable().optional(),
  resolution: z.string().max(2000).nullable().optional(),
});

router.patch('/:id', requirePerm('complaints.write'), (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const existing = db().prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id) as
      | Record<string, unknown> | undefined;
    if (!existing) throw new HttpError(404, 'complaint_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      title: 'title', description: 'description', category: 'category',
      priority: 'priority', status: 'status', assigned_to: 'assigned_to', resolution: 'resolution',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k] === '' ? null : (body as Record<string, unknown>)[k]);
      }
    }
    if (body.status === 'resolved' && existing.status !== 'resolved') {
      fields.push(`resolved_at = datetime('now')`);
    } else if (body.status && body.status !== 'resolved' && existing.status === 'resolved') {
      fields.push(`resolved_at = NULL`);
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE complaints SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('complaints.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM complaints WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'complaint_not_found');
  db().prepare('DELETE FROM complaints WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

const commentSchema = z.object({
  message: z.string().min(1).max(2000),
  is_internal: z.boolean().default(false),
});

router.post('/:id/comments', requirePerm('complaints.write'), (req, res, next) => {
  try {
    const body = commentSchema.parse(req.body);
    const exists = db().prepare('SELECT id FROM complaints WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'complaint_not_found');
    const newId = id('cmc');
    db()
      .prepare(
        `INSERT INTO complaint_comments (id, complaint_id, author_id, message, is_internal)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(newId, req.params.id, req.user!.id, body.message, body.is_internal ? 1 : 0);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

export default router;