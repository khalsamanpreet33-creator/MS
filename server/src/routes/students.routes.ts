import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const studentSchema = z.object({
  admission_no: z.string().min(1).max(40),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  date_of_birth: z.string().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  blood_group: z.string().max(10).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  guardian_name: z.string().max(120).optional().or(z.literal('')),
  guardian_relation: z.string().max(40).optional().or(z.literal('')),
  guardian_phone: z.string().max(40).optional().or(z.literal('')),
  guardian_email: z.string().max(120).optional().or(z.literal('')),
  emergency_contact: z.string().max(40).optional().or(z.literal('')),
  joining_date: z.string().optional().or(z.literal('')),
  current_class_id: z.string().optional().or(z.literal('')),
  current_section_id: z.string().optional().or(z.literal('')),
});

const patchSchema = studentSchema.partial();

function loadStudent(studentId: string) {
  return db()
    .prepare(
      `SELECT s.*, c.name AS class_name, sec.name AS section_name
         FROM students s
         LEFT JOIN classes c ON c.id = s.current_class_id
         LEFT JOIN sections sec ON sec.id = s.current_section_id
         WHERE s.id = ?`,
    )
    .get(studentId);
}

router.get('/', requirePerm('students.read'), (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() ?? '';
  const classId = (req.query.classId as string | undefined) ?? '';
  const sectionId = (req.query.sectionId as string | undefined) ?? '';
  const status = (req.query.status as string | undefined) ?? 'active';
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50)));

  const where: string[] = ['s.status = ?'];
  const params: unknown[] = [status];

  if (q) {
    where.push(
      `(s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_no LIKE ? OR s.guardian_phone LIKE ?)`,
    );
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (classId) {
    where.push('s.current_class_id = ?');
    params.push(classId);
  }
  if (sectionId) {
    where.push('s.current_section_id = ?');
    params.push(sectionId);
  }

  const totalRow = db()
    .prepare(`SELECT COUNT(*) AS n FROM students s WHERE ${where.join(' AND ')}`)
    .get(...params) as { n: number };

  const rows = db()
    .prepare(
      `SELECT s.id, s.admission_no, s.first_name, s.last_name, s.gender,
              s.guardian_name, s.guardian_phone, s.status, s.current_class_id,
              s.current_section_id, c.name AS class_name, sec.name AS section_name
         FROM students s
         LEFT JOIN classes c ON c.id = s.current_class_id
         LEFT JOIN sections sec ON sec.id = s.current_section_id
         WHERE ${where.join(' AND ')}
         ORDER BY s.created_at DESC
         LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json({ total: totalRow.n, page, pageSize, items: rows });
});

router.get('/:id', requirePerm('students.read'), (req, res, next) => {
  try {
    const row = loadStudent(req.params.id);
    if (!row) throw new HttpError(404, 'not_found');
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePerm('students.write'), (req, res, next) => {
  try {
    const body = studentSchema.parse(req.body);
    const exists = db()
      .prepare('SELECT id FROM students WHERE admission_no = ?')
      .get(body.admission_no);
    if (exists) throw new HttpError(409, 'duplicate_admission_no');

    const newId = id('stu');
    db()
      .prepare(
        `INSERT INTO students
          (id, admission_no, first_name, last_name, date_of_birth, gender,
           blood_group, address, guardian_name, guardian_relation, guardian_phone,
           guardian_email, emergency_contact, joining_date, current_class_id,
           current_section_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        body.admission_no,
        body.first_name,
        body.last_name,
        body.date_of_birth || null,
        body.gender || null,
        body.blood_group || null,
        body.address || null,
        body.guardian_name || null,
        body.guardian_relation || null,
        body.guardian_phone || null,
        body.guardian_email || null,
        body.emergency_contact || null,
        body.joining_date || new Date().toISOString().slice(0, 10),
        body.current_class_id || null,
        body.current_section_id || null,
      );
    const created = loadStudent(newId);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePerm('students.write'), (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const existing = loadStudent(req.params.id);
    if (!existing) throw new HttpError(404, 'not_found');

    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      fields.push(`${k} = ?`);
      params.push(v === '' ? null : v);
    }
    if (!fields.length) {
      return res.json(existing);
    }
    fields.push(`updated_at = datetime('now')`);
    params.push(req.params.id);

    db()
      .prepare(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`)
      .run(...params);

    const updated = loadStudent(req.params.id);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePerm('students.delete'), (req, res, next) => {
  try {
    const existing = loadStudent(req.params.id);
    if (!existing) throw new HttpError(404, 'not_found');
    db()
      .prepare(`UPDATE students SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`)
      .run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const transferSchema = z.object({
  class_id: z.string().min(1),
  section_id: z.string().min(1),
  roll_no: z.string().optional(),
  result: z.string().optional(),
  action: z.enum(['promote', 'hold', 'transfer', 'repeat']).default('promote'),
  notes: z.string().optional(),
  academic_year: z.string().min(4),
});

router.post('/:id/transfer', requirePerm('students.write'), (req, res, next) => {
  try {
    const body = transferSchema.parse(req.body);
    const existing = loadStudent(req.params.id);
    if (!existing) throw new HttpError(404, 'not_found');

    const tx = db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO student_class_history
            (id, student_id, class_id, section_id, academic_year, roll_no, result, action, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id('sch'),
          req.params.id,
          body.class_id,
          body.section_id,
          body.academic_year,
          body.roll_no ?? null,
          body.result ?? null,
          body.action,
          body.notes ?? null,
        );
      db()
        .prepare(
          `UPDATE students
             SET current_class_id = ?, current_section_id = ?, updated_at = datetime('now')
             WHERE id = ?`,
        )
        .run(body.class_id, body.section_id, req.params.id);
    });
    tx();

    res.json(loadStudent(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.get('/:id/history', requirePerm('students.read'), (req, res) => {
  const rows = db()
    .prepare(
      `SELECT h.*, c.name AS class_name, sec.name AS section_name
         FROM student_class_history h
         LEFT JOIN classes c ON c.id = h.class_id
         LEFT JOIN sections sec ON sec.id = h.section_id
         WHERE h.student_id = ?
         ORDER BY h.created_at DESC`,
    )
    .all(req.params.id);
  res.json({ items: rows });
});

export default router;