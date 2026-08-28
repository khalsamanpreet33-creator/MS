import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface ExamRow {
  id: string;
  term_id: string;
  term_name: string;
  academic_year: string;
  name: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  exam_date: string | null;
  max_marks: number;
  passing_marks: number;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  marks_entered: number;
  total_students: number;
}

function gradeFor(percent: number, scales: { min_percent: number; max_percent: number; grade: string; gpa: number }[]) {
  for (const s of scales) {
    if (percent >= s.min_percent && percent <= s.max_percent) return s;
  }
  return null;
}

// Exam terms
router.get('/terms', requirePerm('exams.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT et.*, (SELECT COUNT(*) FROM exams e WHERE e.term_id = et.id) AS exam_count
         FROM exam_terms et ORDER BY et.academic_year DESC, et.name`,
    )
    .all();
  res.json({ items: rows });
});

const termSchema = z.object({
  name: z.string().min(1).max(120),
  academic_year: z.string().min(4).max(20),
  start_date: z.string().max(20).nullable().optional(),
  end_date: z.string().max(20).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.post('/terms', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = termSchema.parse(req.body);
    const newId = id('term');
    try {
      db()
        .prepare(
          `INSERT INTO exam_terms (id, name, academic_year, start_date, end_date, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(newId, body.name, body.academic_year, body.start_date ?? null, body.end_date ?? null, body.status);
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'duplicate_term');
      throw e;
    }
    const row = db().prepare('SELECT * FROM exam_terms WHERE id = ?').get(newId);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.delete('/terms/:id', requirePerm('exams.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM exam_terms WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'term_not_found');
  db().prepare('DELETE FROM exam_terms WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Exams
router.get('/', requirePerm('exams.read'), (req, res) => {
  const termId = typeof req.query.termId === 'string' ? req.query.termId : '';
  const classId = typeof req.query.classId === 'string' ? req.query.classId : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (termId) { where.push('e.term_id = ?'); params.push(termId); }
  if (classId) { where.push('e.class_id = ?'); params.push(classId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT e.*, et.name AS term_name, et.academic_year, c.name AS class_name, s.name AS subject_name,
              (SELECT COUNT(*) FROM marks m WHERE m.exam_id = e.id) AS marks_entered,
              (SELECT COUNT(*) FROM students st WHERE st.current_class_id = e.class_id AND st.status = 'active') AS total_students
         FROM exams e
         JOIN exam_terms et ON et.id = e.term_id
         JOIN classes c ON c.id = e.class_id
         JOIN subjects s ON s.id = e.subject_id
         ${clause}
         ORDER BY e.exam_date DESC, c.name, s.name LIMIT 500`,
    )
    .all(...params) as ExamRow[];
  res.json({ items: rows });
});

const examSchema = z.object({
  term_id: z.string().min(1),
  name: z.string().min(1).max(120),
  class_id: z.string().min(1),
  subject_id: z.string().min(1),
  exam_date: z.string().max(20).nullable().optional(),
  max_marks: z.number().min(0).default(100),
  passing_marks: z.number().min(0).default(35),
  status: z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']).default('scheduled'),
});

router.post('/', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = examSchema.parse(req.body);
    const newId = id('exam');
    try {
      db()
        .prepare(
          `INSERT INTO exams (id, term_id, name, class_id, subject_id, exam_date, max_marks, passing_marks, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(newId, body.term_id, body.name, body.class_id, body.subject_id,
             body.exam_date ?? null, body.max_marks, body.passing_marks, body.status);
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'duplicate_exam');
      throw e;
    }
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = examSchema.partial().parse(req.body);
    const exists = db().prepare('SELECT id FROM exams WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'exam_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      term_id: 'term_id', name: 'name', class_id: 'class_id', subject_id: 'subject_id',
      exam_date: 'exam_date', max_marks: 'max_marks', passing_marks: 'passing_marks', status: 'status',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k] === '' ? null : (body as Record<string, unknown>)[k]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE exams SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('exams.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM exams WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'exam_not_found');
  db().prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Grade scales
router.get('/grade-scales', requirePerm('exams.read'), (_req, res) => {
  const rows = db().prepare('SELECT * FROM grade_scales ORDER BY min_percent DESC').all();
  res.json({ items: rows });
});

// Marks for an exam (with students)
router.get('/:id/marks', requirePerm('exams.read'), (req, res) => {
  const exam = db()
    .prepare(`SELECT e.*, s.name AS subject_name, c.name AS class_name, et.name AS term_name
                FROM exams e JOIN subjects s ON s.id = e.subject_id
                JOIN classes c ON c.id = e.class_id
                JOIN exam_terms et ON et.id = e.term_id WHERE e.id = ?`)
    .get(req.params.id) as Record<string, unknown> | undefined;
  if (!exam) throw new HttpError(404, 'exam_not_found');

  const students = db()
    .prepare(`SELECT id, admission_no, first_name, last_name FROM students
                WHERE current_class_id = ? AND status = 'active' ORDER BY first_name, last_name`)
    .all((exam as { class_id: string }).class_id) as { id: string; admission_no: string; first_name: string; last_name: string }[];

  const marks = db()
    .prepare('SELECT student_id, marks_obtained, is_absent, remarks FROM marks WHERE exam_id = ?')
    .all(req.params.id) as { student_id: string; marks_obtained: number | null; is_absent: number; remarks: string | null }[];

  const scales = db().prepare('SELECT min_percent, max_percent, grade, gpa FROM grade_scales').all() as { min_percent: number; max_percent: number; grade: string; gpa: number }[];

  const merged = students.map((st) => {
    const m = marks.find((x) => x.student_id === st.id);
    const obtained = m?.marks_obtained ?? null;
    const absent = m?.is_absent ?? 0;
    const max = (exam as { max_marks: number }).max_marks;
    const percent = obtained !== null && max > 0 ? (obtained / max) * 100 : null;
    const grade = percent !== null ? gradeFor(percent, scales) : null;
    return {
      student_id: st.id,
      admission_no: st.admission_no,
      name: `${st.first_name} ${st.last_name}`,
      marks_obtained: obtained,
      is_absent: absent,
      remarks: m?.remarks ?? null,
      percent: percent !== null ? Math.round(percent * 100) / 100 : null,
      grade: grade?.grade ?? null,
      gpa: grade?.gpa ?? null,
      pass: percent !== null && percent >= (((exam as { passing_marks: number }).passing_marks) / max) * 100,
    };
  });

  res.json({ exam, marks: merged });
});

const marksSchema = z.object({
  entries: z.array(z.object({
    student_id: z.string().min(1),
    marks_obtained: z.number().min(0).nullable(),
    is_absent: z.boolean().default(false),
    remarks: z.string().max(500).nullable().optional(),
  })).min(1).max(500),
});

router.post('/:id/marks', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = marksSchema.parse(req.body);
    const exists = db().prepare('SELECT id FROM exams WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'exam_not_found');

    const insert = db().prepare(
      `INSERT INTO marks (id, exam_id, student_id, marks_obtained, is_absent, remarks, entered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(exam_id, student_id) DO UPDATE SET
         marks_obtained = excluded.marks_obtained,
         is_absent = excluded.is_absent,
         remarks = excluded.remarks,
         entered_by = excluded.entered_by,
         updated_at = datetime('now')`,
    );
    const tx = db().transaction(() => {
      for (const e of body.entries) {
        insert.run(id('mk'), req.params.id, e.student_id, e.marks_obtained, e.is_absent ? 1 : 0, e.remarks ?? null, req.user!.id);
      }
    });
    tx();
    res.json({ ok: true, count: body.entries.length });
  } catch (e) { next(e); }
});

export default router;
