import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface TopicRow {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  planned_date: string | null;
  status: string;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const topicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  planned_date: z.string().nullable().optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'skipped']).default('planned'),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

function getSubject(subjectId: string): { id: string } {
  const row = db().prepare('SELECT id FROM subjects WHERE id = ?').get(subjectId) as { id: string } | undefined;
  if (!row) throw new HttpError(404, 'subject_not_found');
  return row;
}

router.get('/subjects/:subjectId/topics', requirePerm('academics.read'), (req, res) => {
  getSubject(req.params.subjectId);
  const rows = db()
    .prepare(
      `SELECT id, subject_id, title, description, planned_date, status, completed_at,
              sort_order, created_at, updated_at
         FROM syllabus_topics
         WHERE subject_id = ?
         ORDER BY sort_order, created_at`,
    )
    .all(req.params.subjectId) as TopicRow[];
  res.json({ items: rows });
});

router.get('/subjects/:subjectId/progress', requirePerm('academics.read'), (req, res) => {
  getSubject(req.params.subjectId);
  const stats = db()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
         SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) AS planned,
         SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped
         FROM syllabus_topics WHERE subject_id = ?`,
    )
    .get(req.params.subjectId) as { total: number; completed: number; in_progress: number; planned: number; skipped: number };
  const total = stats.total ?? 0;
  const completed = stats.completed ?? 0;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  res.json({ ...stats, total, completed, completion_pct: pct });
});

router.post('/subjects/:subjectId/topics', requirePerm('academics.write'), (req, res, next) => {
  try {
    getSubject(req.params.subjectId);
    const body = topicSchema.parse(req.body);
    const newId = id('syt');
    db()
      .prepare(
        `INSERT INTO syllabus_topics (id, subject_id, title, description, planned_date, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, req.params.subjectId, body.title, body.description ?? null, body.planned_date ?? null, body.status, body.sort_order);

    if (body.status === 'completed') {
      db().prepare(`UPDATE syllabus_topics SET completed_at = datetime('now') WHERE id = ?`).run(newId);
    }

    const created = db()
      .prepare(`SELECT * FROM syllabus_topics WHERE id = ?`)
      .get(newId) as TopicRow;
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

const patchSchema = topicSchema.partial();

router.patch('/topics/:id', requirePerm('academics.write'), (req, res, next) => {
  try {
    const existing = db().prepare('SELECT * FROM syllabus_topics WHERE id = ?').get(req.params.id) as TopicRow | undefined;
    if (!existing) throw new HttpError(404, 'topic_not_found');

    const body = patchSchema.parse(req.body);
    const merged = {
      title: body.title ?? existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      planned_date: body.planned_date !== undefined ? body.planned_date : existing.planned_date,
      status: body.status ?? existing.status,
      sort_order: body.sort_order ?? existing.sort_order,
    };
    const completedAt = body.status === 'completed' && existing.status !== 'completed'
      ? new Date().toISOString()
      : body.status && body.status !== 'completed'
        ? null
        : existing.completed_at;

    db()
      .prepare(
        `UPDATE syllabus_topics
            SET title = ?, description = ?, planned_date = ?, status = ?, sort_order = ?,
                completed_at = ?, updated_at = datetime('now')
          WHERE id = ?`,
      )
      .run(merged.title, merged.description, merged.planned_date, merged.status, merged.sort_order, completedAt, req.params.id);

    const updated = db().prepare('SELECT * FROM syllabus_topics WHERE id = ?').get(req.params.id) as TopicRow;
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/topics/:id', requirePerm('academics.write'), (req, res, next) => {
  const existing = db().prepare('SELECT id FROM syllabus_topics WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'topic_not_found');
  db().prepare('DELETE FROM syllabus_topics WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
