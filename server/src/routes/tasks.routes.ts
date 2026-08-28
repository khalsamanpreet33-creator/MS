import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  created_by: string;
  created_by_name: string;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  related_to: string | null;
  related_id: string | null;
  created_at: string;
}

const taskSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).default('open'),
  due_date: z.string().nullable().optional(),
  related_to: z.string().max(40).nullable().optional(),
  related_id: z.string().nullable().optional(),
});

router.get('/', requirePerm('tasks.read'), (req, res) => {
  const mine = req.query.mine === '1';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (mine) { where.push('t.assignee_id = ?'); params.push(req.user!.id); }
  if (status) { where.push('t.status = ?'); params.push(status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT t.*, ua.full_name AS assignee_name, uc.full_name AS created_by_name
         FROM tasks t
         LEFT JOIN users ua ON ua.id = t.assignee_id
         JOIN users uc ON uc.id = t.created_by
         ${clause}
         ORDER BY
           CASE t.status WHEN 'done' THEN 3 WHEN 'cancelled' THEN 4 WHEN 'in_progress' THEN 2 ELSE 1 END,
           CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
           t.due_date ASC NULLS LAST`,
    )
    .all(...params) as TaskRow[];
  res.json({ items: rows });
});

router.post('/', requirePerm('tasks.write'), (req, res, next) => {
  try {
    const body = taskSchema.parse(req.body);
    const newId = id('tsk');
    db()
      .prepare(
        `INSERT INTO tasks (id, title, description, assignee_id, created_by, priority, status, due_date, related_to, related_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.title, body.description ?? null, body.assignee_id ?? null,
           req.user!.id, body.priority, body.status, body.due_date ?? null,
           body.related_to ?? null, body.related_id ?? null);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('tasks.write'), (req, res, next) => {
  try {
    const body = taskSchema.partial().parse(req.body);
    const existing = db().prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as
      | Record<string, unknown> | undefined;
    if (!existing) throw new HttpError(404, 'task_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      title: 'title', description: 'description', assignee_id: 'assignee_id',
      priority: 'priority', status: 'status', due_date: 'due_date',
      related_to: 'related_to', related_id: 'related_id',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k] === '' ? null : (body as Record<string, unknown>)[k]);
      }
    }
    if (body.status === 'done' && existing.status !== 'done') {
      fields.push(`completed_at = datetime('now')`);
    } else if (body.status && body.status !== 'done' && existing.status === 'done') {
      fields.push(`completed_at = NULL`);
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('tasks.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'task_not_found');
  db().prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;