import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface HwRow {
  id: string;
  class_id: string;
  class_name: string;
  section_id: string | null;
  section_name: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  title: string;
  description: string | null;
  assigned_date: string;
  due_date: string | null;
  attachments: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  submission_count: number;
  total_students: number;
}

const hwSchema = z.object({
  class_id: z.string().min(1),
  section_id: z.string().nullable().optional(),
  subject_id: z.string().min(1),
  title: z.string().min(1).max(160),
  description: z.string().max(4000).nullable().optional(),
  assigned_date: z.string().min(8),
  due_date: z.string().max(20).nullable().optional(),
  attachments: z.string().max(2000).nullable().optional(),
});

router.get('/', requirePerm('homework.read'), (req, res) => {
  const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : '';
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : '';

  const where: string[] = [];
  const params: unknown[] = [];
  if (classId) { where.push('h.class_id = ?'); params.push(classId); }
  if (sectionId) { where.push('(h.section_id = ? OR h.section_id IS NULL)'); params.push(sectionId); }
  if (subjectId) { where.push('h.subject_id = ?'); params.push(subjectId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db()
    .prepare(
      `SELECT h.*, c.name AS class_name, sec.name AS section_name,
              s.name AS subject_name, s.code AS subject_code,
              u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM homework_submissions hs WHERE hs.homework_id = h.id) AS submission_count,
              (SELECT COUNT(*) FROM students st WHERE st.current_class_id = h.class_id
                  AND (h.section_id IS NULL OR st.current_section_id = h.section_id) AND st.status = 'active') AS total_students
         FROM homework h
         JOIN classes c ON c.id = h.class_id
         LEFT JOIN sections sec ON sec.id = h.section_id
         JOIN subjects s ON s.id = h.subject_id
         LEFT JOIN users u ON u.id = h.created_by
         ${clause}
         ORDER BY h.assigned_date DESC, h.created_at DESC LIMIT 200`,
    )
    .all(...params) as HwRow[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('homework.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT h.*, c.name AS class_name, sec.name AS section_name,
              s.name AS subject_name, s.code AS subject_code,
              u.full_name AS created_by_name
         FROM homework h
         JOIN classes c ON c.id = h.class_id
         LEFT JOIN sections sec ON sec.id = h.section_id
         JOIN subjects s ON s.id = h.subject_id
         LEFT JOIN users u ON u.id = h.created_by
         WHERE h.id = ?`,
    )
    .get(req.params.id) as HwRow | undefined;
  if (!row) throw new HttpError(404, 'homework_not_found');
  const submissions = db()
    .prepare(
      `SELECT hs.*, st.admission_no, st.first_name, st.last_name FROM homework_submissions hs
         JOIN students st ON st.id = hs.student_id WHERE hs.homework_id = ?
         ORDER BY st.first_name, st.last_name`,
    )
    .all(req.params.id);
  res.json({ ...row, submissions });
});

router.post('/', requirePerm('homework.write'), (req, res, next) => {
  try {
    const body = hwSchema.parse(req.body);
    const newId = id('hw');
    db()
      .prepare(
        `INSERT INTO homework (id, class_id, section_id, subject_id, title, description, assigned_date, due_date, attachments, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.class_id, body.section_id ?? null, body.subject_id, body.title,
           body.description ?? null, body.assigned_date, body.due_date ?? null,
           body.attachments ?? null, req.user!.id);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('homework.write'), (req, res, next) => {
  try {
    const body = hwSchema.partial().parse(req.body);
    const exists = db().prepare('SELECT id FROM homework WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'homework_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      class_id: 'class_id', section_id: 'section_id', subject_id: 'subject_id', title: 'title',
      description: 'description', assigned_date: 'assigned_date', due_date: 'due_date', attachments: 'attachments',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k] === '' ? null : (body as Record<string, unknown>)[k]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE homework SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('homework.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM homework WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'homework_not_found');
  db().prepare('DELETE FROM homework WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Submission tracking
const submissionSchema = z.object({
  student_id: z.string().min(1),
  status: z.enum(['pending', 'submitted', 'late', 'reviewed']).default('submitted'),
  remarks: z.string().max(500).nullable().optional(),
});

router.post('/:id/submissions', requirePerm('homework.write'), (req, res, next) => {
  try {
    const body = submissionSchema.parse(req.body);
    const exists = db().prepare('SELECT id FROM homework WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'homework_not_found');
    const newId = id('hws');
    db()
      .prepare(
        `INSERT INTO homework_submissions (id, homework_id, student_id, status, submitted_at, remarks)
         VALUES (?, ?, ?, ?, CASE WHEN ? IN ('submitted','late','reviewed') THEN datetime('now') ELSE NULL END, ?)
         ON CONFLICT(homework_id, student_id) DO UPDATE SET
           status = excluded.status,
           submitted_at = CASE WHEN excluded.status IN ('submitted','late','reviewed') THEN datetime('now') ELSE submitted_at END,
           remarks = excluded.remarks,
           updated_at = datetime('now')`,
      )
      .run(newId, req.params.id, body.student_id, body.status, body.status, body.remarks ?? null);
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
