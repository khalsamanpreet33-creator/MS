import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Grade scale lookup (small enough to send to client)
router.get('/grade-scales', requirePerm('results.read'), (_req, res) => {
  const rows = db()
    .prepare(`SELECT * FROM grade_scales ORDER BY min_percent DESC`)
    .all();
  res.json({ items: rows });
});

// Mark sheet for a class+exam
router.get('/marksheet', requirePerm('results.read'), (req, res, next) => {
  try {
    const schema = z.object({
      exam_id: z.string().min(1),
      class_id: z.string().min(1),
    });
    const { exam_id, class_id } = schema.parse(req.query);
    const exam = db()
      .prepare(`SELECT * FROM exams WHERE id = ?`)
      .get(exam_id) as { name: string; max_marks: number; passing_marks: number; subject_id: string } | undefined;
    if (!exam) throw new HttpError(404, 'exam_not_found');
    const students = db()
      .prepare(
        `SELECT id, admission_no, first_name, last_name FROM students
          WHERE current_class_id = ? AND status = 'active' ORDER BY last_name, first_name`,
      )
      .all(class_id) as Array<{ id: string; admission_no: string; first_name: string; last_name: string }>;
    const marks = db()
      .prepare(`SELECT * FROM marks WHERE exam_id = ?`)
      .all(exam_id) as Array<{ student_id: string; marks_obtained: number; is_absent: number }>;
    const byStudent = new Map(marks.map((m) => [m.student_id, m]));
    const grades = db().prepare(`SELECT * FROM grade_scales ORDER BY min_percent DESC`).all() as Array<{ grade: string; min_percent: number; max_percent: number }>;
    function gradeOf(pct: number): string {
      const g = grades.find((g) => pct >= g.min_percent && pct <= g.max_percent);
      return g ? g.grade : '-';
    }
    const items = students.map((s) => {
      const m = byStudent.get(s.id);
      const obtained = m?.marks_obtained ?? null;
      const absent = m?.is_absent === 1;
      const pct = obtained != null ? (obtained / exam.max_marks) * 100 : null;
      return {
        student_id: s.id,
        admission_no: s.admission_no,
        name: `${s.first_name} ${s.last_name}`,
        marks_obtained: obtained,
        is_absent: absent,
        percentage: pct != null ? Number(pct.toFixed(2)) : null,
        grade: pct != null ? gradeOf(pct) : null,
      };
    });
    const present = items.filter((i) => !i.is_absent && i.marks_obtained != null);
    const stats = {
      total: students.length,
      entered: marks.length,
      average: present.length ? Number((present.reduce((s, i) => s + (i.marks_obtained ?? 0), 0) / present.length).toFixed(2)) : 0,
      highest: present.length ? Math.max(...present.map((i) => i.marks_obtained ?? 0)) : 0,
      lowest: present.length ? Math.min(...present.map((i) => i.marks_obtained ?? 0)) : 0,
      pass_count: present.filter((i) => (i.marks_obtained ?? 0) >= exam.passing_marks).length,
    };
    res.json({ exam, items, stats });
  } catch (e) { next(e); }
});

const markSchema = z.object({
  exam_id: z.string().min(1),
  student_id: z.string().min(1),
  marks_obtained: z.number().min(0).nullable(),
  is_absent: z.boolean().default(false),
  remarks: z.string().max(500).nullable().optional(),
});

router.post('/marks', requirePerm('results.write'), (req, res, next) => {
  try {
    const body = markSchema.parse(req.body);
    const exam = db().prepare(`SELECT max_marks FROM exams WHERE id = ?`).get(body.exam_id) as { max_marks: number } | undefined;
    if (!exam) throw new HttpError(404, 'exam_not_found');
    if (body.marks_obtained != null && body.marks_obtained > exam.max_marks) {
      throw new HttpError(400, 'marks_exceed_max');
    }
    const existing = db()
      .prepare(`SELECT id FROM marks WHERE exam_id = ? AND student_id = ?`)
      .get(body.exam_id, body.student_id);
    if (existing) {
      db()
        .prepare(
          `UPDATE marks SET marks_obtained = ?, is_absent = ?, remarks = ?, updated_at = datetime('now') WHERE exam_id = ? AND student_id = ?`,
        )
        .run(body.marks_obtained, body.is_absent ? 1 : 0, body.remarks ?? null, body.exam_id, body.student_id);
      res.json({ ok: true, updated: true });
    } else {
      db()
        .prepare(
          `INSERT INTO marks (id, exam_id, student_id, marks_obtained, is_absent, remarks, entered_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id('mrk'), body.exam_id, body.student_id, body.marks_obtained, body.is_absent ? 1 : 0,
             body.remarks ?? null, req.user!.id);
      res.status(201).json({ id: id('mrk') });
    }
  } catch (e) { next(e); }
});

// Student-facing report card: aggregates all exams for a student in a term
router.get('/report-card', requirePerm('results.read'), (req, res, next) => {
  try {
    const schema = z.object({
      student_id: z.string().min(1),
      term_id: z.string().min(1),
    });
    const { student_id, term_id } = schema.parse(req.query);
    const student = db()
      .prepare(`SELECT id, admission_no, first_name, last_name FROM students WHERE id = ?`)
      .get(student_id) as { id: string; admission_no: string; first_name: string; last_name: string } | undefined;
    if (!student) throw new HttpError(404, 'student_not_found');
    const term = db()
      .prepare(`SELECT * FROM exam_terms WHERE id = ?`)
      .get(term_id) as { name: string } | undefined;
    if (!term) throw new HttpError(404, 'term_not_found');
    const rows = db()
      .prepare(
        `SELECT e.id AS exam_id, e.name AS exam_name, s.name AS subject_name,
                e.max_marks, m.marks_obtained, m.is_absent
           FROM exams e
           LEFT JOIN marks m ON m.exam_id = e.id AND m.student_id = ?
           JOIN subjects s ON s.id = e.subject_id
          WHERE e.term_id = ?
          ORDER BY s.name, e.exam_date`,
      )
      .all(student_id, term_id) as Array<{ exam_id: string; exam_name: string; subject_name: string; max_marks: number; marks_obtained: number | null; is_absent: number }>;
    const grades = db().prepare(`SELECT * FROM grade_scales ORDER BY min_percent DESC`).all() as Array<{ grade: string; min_percent: number; max_percent: number }>;
    function gradeOf(pct: number): string {
      const g = grades.find((g) => pct >= g.min_percent && pct <= g.max_percent);
      return g ? g.grade : '-';
    }
    const items = rows.map((r) => {
      const pct = r.marks_obtained != null ? (r.marks_obtained / r.max_marks) * 100 : null;
      return {
        ...r,
        percentage: pct != null ? Number(pct.toFixed(2)) : null,
        grade: pct != null ? gradeOf(pct) : null,
      };
    });
    const present = items.filter((i) => i.marks_obtained != null);
    const total = present.reduce((s, i) => s + (i.marks_obtained ?? 0), 0);
    const max = present.reduce((s, i) => s + i.max_marks, 0);
    const overallPct = max ? Number(((total / max) * 100).toFixed(2)) : 0;
    res.json({
      student,
      term,
      items,
      summary: {
        total,
        max,
        percentage: overallPct,
        grade: gradeOf(overallPct),
        subjects: present.length,
      },
    });
  } catch (e) { next(e); }
});

export default router;
