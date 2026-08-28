import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface PeriodRow {
  id: string;
  class_id: string;
  section_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  teacher_id: string;
  teacher_name: string;
  room: string | null;
  notes: string | null;
}

const periodSchema = z.object({
  class_id: z.string().min(1),
  section_id: z.string().min(1),
  day_of_week: z.number().int().min(0).max(6),
  period_number: z.number().int().min(1).max(12),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  subject_id: z.string().min(1),
  teacher_id: z.string().min(1),
  room: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

interface Conflict {
  type: 'teacher_double_booked' | 'section_double_booked';
  day_of_week: number;
  period_number: number;
  teacher_id?: string;
  section_id?: string;
  conflicting_period_id: string;
}

function findConflicts(
  section_id: string,
  teacher_id: string,
  day_of_week: number,
  period_number: number,
  exclude_id?: string,
): Conflict[] {
  const conflicts: Conflict[] = [];
  const sectionDup = db()
    .prepare(
      `SELECT id FROM timetable_periods
        WHERE section_id = ? AND day_of_week = ? AND period_number = ?
          AND (? IS NULL OR id != ?)`,
    )
    .get(section_id, day_of_week, period_number, exclude_id ?? null, exclude_id ?? '') as
    | { id: string }
    | undefined;
  if (sectionDup) {
    conflicts.push({
      type: 'section_double_booked',
      day_of_week,
      period_number,
      section_id,
      conflicting_period_id: sectionDup.id,
    });
  }
  const teacherDup = db()
    .prepare(
      `SELECT id FROM timetable_periods
        WHERE teacher_id = ? AND day_of_week = ? AND period_number = ?
          AND (? IS NULL OR id != ?)`,
    )
    .get(teacher_id, day_of_week, period_number, exclude_id ?? null, exclude_id ?? '') as
    | { id: string }
    | undefined;
  if (teacherDup) {
    conflicts.push({
      type: 'teacher_double_booked',
      day_of_week,
      period_number,
      teacher_id,
      conflicting_period_id: teacherDup.id,
    });
  }
  return conflicts;
}

// GET /timetable?sectionId=...&teacherId=...&classId=...
router.get('/', requirePerm('timetable.read'), (req, res) => {
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : '';
  const teacherId = typeof req.query.teacherId === 'string' ? req.query.teacherId : '';
  const classId = typeof req.query.classId === 'string' ? req.query.classId : '';

  const where: string[] = [];
  const params: unknown[] = [];
  if (sectionId) { where.push('p.section_id = ?'); params.push(sectionId); }
  if (teacherId) { where.push('p.teacher_id = ?'); params.push(teacherId); }
  if (classId) { where.push('p.class_id = ?'); params.push(classId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db()
    .prepare(
      `SELECT p.*, s.name AS subject_name, s.code AS subject_code, u.full_name AS teacher_name
         FROM timetable_periods p
         JOIN subjects s ON s.id = p.subject_id
         JOIN users u ON u.id = p.teacher_id
         ${clause}
         ORDER BY p.section_id, p.day_of_week, p.period_number`,
    )
    .all(...params) as PeriodRow[];
  res.json({ items: rows });
});

// POST /timetable — validate uniqueness, return conflicts if any
router.post('/', requirePerm('timetable.write'), (req, res, next) => {
  try {
    const body = periodSchema.parse(req.body);
    const conflicts = findConflicts(body.section_id, body.teacher_id, body.day_of_week, body.period_number);
    if (conflicts.length > 0) {
      res.status(409).json({ error: 'conflict', conflicts });
      return;
    }
    const newId = id('ttp');
    db()
      .prepare(
        `INSERT INTO timetable_periods
          (id, class_id, section_id, day_of_week, period_number, start_time, end_time, subject_id, teacher_id, room, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        body.class_id,
        body.section_id,
        body.day_of_week,
        body.period_number,
        body.start_time,
        body.end_time,
        body.subject_id,
        body.teacher_id,
        body.room ?? null,
        body.notes ?? null,
      );
    res.status(201).json({ id: newId });
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'duplicate_slot', message: 'A period is already scheduled for this slot.' });
      return;
    }
    next(e);
  }
});

// PATCH /timetable/:id
router.patch('/:id', requirePerm('timetable.write'), (req, res, next) => {
  try {
    const body = periodSchema.partial().parse(req.body);
    const existing = db().prepare('SELECT * FROM timetable_periods WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) throw new HttpError(404, 'period_not_found');

    const merged = {
      class_id: body.class_id ?? (existing.class_id as string),
      section_id: body.section_id ?? (existing.section_id as string),
      day_of_week: body.day_of_week ?? (existing.day_of_week as number),
      period_number: body.period_number ?? (existing.period_number as number),
      start_time: body.start_time ?? (existing.start_time as string),
      end_time: body.end_time ?? (existing.end_time as string),
      subject_id: body.subject_id ?? (existing.subject_id as string),
      teacher_id: body.teacher_id ?? (existing.teacher_id as string),
      room: body.room !== undefined ? body.room : (existing.room as string | null),
      notes: body.notes !== undefined ? body.notes : (existing.notes as string | null),
    };

    const conflicts = findConflicts(
      merged.section_id,
      merged.teacher_id,
      merged.day_of_week,
      merged.period_number,
      req.params.id,
    );
    if (conflicts.length > 0) {
      res.status(409).json({ error: 'conflict', conflicts });
      return;
    }

    db()
      .prepare(
        `UPDATE timetable_periods
            SET class_id = ?, section_id = ?, day_of_week = ?, period_number = ?, start_time = ?, end_time = ?,
                subject_id = ?, teacher_id = ?, room = ?, notes = ?, updated_at = datetime('now')
          WHERE id = ?`,
      )
      .run(
        merged.class_id,
        merged.section_id,
        merged.day_of_week,
        merged.period_number,
        merged.start_time,
        merged.end_time,
        merged.subject_id,
        merged.teacher_id,
        merged.room,
        merged.notes,
        req.params.id,
      );
    res.json({ ok: true });
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'duplicate_slot' });
      return;
    }
    next(e);
  }
});

router.delete('/:id', requirePerm('timetable.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM timetable_periods WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'period_not_found');
  db().prepare('DELETE FROM timetable_periods WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Substitutions
const substitutionSchema = z.object({
  period_id: z.string().min(1),
  substitute_teacher_id: z.string().min(1),
  substitution_date: z.string().min(8),
  reason: z.string().max(500).nullable().optional(),
});

router.get('/substitutions', requirePerm('timetable.read'), (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (date) { where.push('s.substitution_date = ?'); params.push(date); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT s.*, p.day_of_week, p.period_number, p.start_time, p.end_time, p.section_id,
              sec.name AS section_name, c.name AS class_name,
              sub.name AS subject_name, sub.code AS subject_code,
              orig.full_name AS original_teacher_name,
              sub_t.full_name AS substitute_teacher_name
         FROM timetable_substitutions s
         JOIN timetable_periods p ON p.id = s.period_id
         JOIN sections sec ON sec.id = p.section_id
         JOIN classes c ON c.id = sec.class_id
         JOIN subjects sub ON sub.id = p.subject_id
         JOIN users orig ON orig.id = s.original_teacher_id
         JOIN users sub_t ON sub_t.id = s.substitute_teacher_id
         ${clause}
         ORDER BY s.substitution_date DESC, p.period_number`,
    )
    .all(...params);
  res.json({ items: rows });
});

router.post('/substitutions', requirePerm('timetable.write'), (req, res, next) => {
  try {
    const body = substitutionSchema.parse(req.body);
    const period = db()
      .prepare('SELECT teacher_id FROM timetable_periods WHERE id = ?')
      .get(body.period_id) as { teacher_id: string } | undefined;
    if (!period) throw new HttpError(404, 'period_not_found');
    const newId = id('tts');
    try {
      db()
        .prepare(
          `INSERT INTO timetable_substitutions
            (id, period_id, original_teacher_id, substitute_teacher_id, substitution_date, reason, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newId,
          body.period_id,
          period.teacher_id,
          body.substitute_teacher_id,
          body.substitution_date,
          body.reason ?? null,
          req.user!.id,
        );
    } catch (e) {
      if (typeof e === 'object' && e && 'code' in e && (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new HttpError(409, 'duplicate_substitution');
      }
      throw e;
    }
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.delete('/substitutions/:id', requirePerm('timetable.write'), (req, res) => {
  const exists = db().prepare('SELECT id FROM timetable_substitutions WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'substitution_not_found');
  db().prepare('DELETE FROM timetable_substitutions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;