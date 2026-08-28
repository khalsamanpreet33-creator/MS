import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface SubjectRow {
  id: string;
  class_id: string;
  class_name: string;
  code: string;
  name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  status: string;
  created_at: string;
  topic_count: number;
  completed_count: number;
}

const subjectSchema = z.object({
  class_id: z.string().min(1),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(80),
  teacher_id: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

function subjectSelect(): string {
  return `
    SELECT s.id, s.class_id, c.name AS class_name, s.code, s.name,
           s.teacher_id, u.full_name AS teacher_name, s.status, s.created_at,
           (SELECT COUNT(*) FROM syllabus_topics t WHERE t.subject_id = s.id) AS topic_count,
           (SELECT COUNT(*) FROM syllabus_topics t WHERE t.subject_id = s.id AND t.status = 'completed') AS completed_count
      FROM subjects s
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN users u ON u.id = s.teacher_id
  `;
}

function listSubjects(classId?: string): SubjectRow[] {
  const sql = classId
    ? `${subjectSelect()} WHERE s.class_id = ? ORDER BY c.grade_level, c.name, s.code`
    : `${subjectSelect()} ORDER BY c.grade_level, c.name, s.code`;
  return (classId ? db().prepare(sql).all(classId) : db().prepare(sql).all()) as SubjectRow[];
}

function getSubjectById(id: string): SubjectRow | undefined {
  const rows = db().prepare(`${subjectSelect()} WHERE s.id = ?`).all(id) as SubjectRow[];
  return rows[0];
}

router.get('/', requirePerm('academics.read'), (req, res) => {
  const classId = typeof req.query.class_id === 'string' ? req.query.class_id : undefined;
  res.json({ items: listSubjects(classId) });
});

router.get('/:id', requirePerm('academics.read'), (req, res, next) => {
  const row = getSubjectById(req.params.id);
  if (!row) throw new HttpError(404, 'not_found');
  res.json(row);
});

router.post('/', requirePerm('academics.write'), (req, res, next) => {
  try {
    const body = subjectSchema.parse(req.body);
    const newId = id('sub');
    try {
      db()
        .prepare(
          `INSERT INTO subjects (id, class_id, code, name, teacher_id, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(newId, body.class_id, body.code, body.name, body.teacher_id ?? null, body.status);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new HttpError(409, 'duplicate_code', 'A subject with this code already exists for the class.');
      }
      throw e;
    }
    const created = getSubjectById(newId);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePerm('academics.write'), (req, res, next) => {
  try {
    const body = subjectSchema.partial().parse(req.body);
    const existing = db().prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) throw new HttpError(404, 'not_found');

    const merged = {
      class_id: body.class_id ?? existing.class_id,
      code: body.code ?? existing.code,
      name: body.name ?? existing.name,
      teacher_id: body.teacher_id !== undefined ? body.teacher_id : existing.teacher_id,
      status: body.status ?? existing.status,
    };
    db()
      .prepare(
        `UPDATE subjects
            SET class_id = ?, code = ?, name = ?, teacher_id = ?, status = ?, updated_at = datetime('now')
          WHERE id = ?`,
      )
      .run(merged.class_id, merged.code, merged.name, merged.teacher_id, merged.status, req.params.id);

    const updated = getSubjectById(req.params.id);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePerm('academics.write'), (req, res, next) => {
  const existing = db().prepare('SELECT status FROM subjects WHERE id = ?').get(req.params.id) as { status: string } | undefined;
  if (!existing) throw new HttpError(404, 'not_found');
  db().prepare(`UPDATE subjects SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

export default router;
