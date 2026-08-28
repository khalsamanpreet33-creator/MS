import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';
import { bus, broadcastChannel } from '../lib/sse.js';

const router = Router();
router.use(requireAuth);

const openSessionSchema = z.object({
  class_id: z.string().min(1),
  section_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

const recordSchema = z.object({
  status: z.enum(['present', 'absent', 'leave']),
  remarks: z.string().max(200).optional(),
});

const bulkRecordsSchema = z.object({
  records: z
    .array(
      z.object({
        student_id: z.string().min(1),
        status: z.enum(['present', 'absent', 'leave']),
        remarks: z.string().max(200).optional(),
      }),
    )
    .min(1),
});

router.get('/sessions', requirePerm('attendance.read'), (req, res) => {
  const classId = (req.query.classId as string | undefined) ?? '';
  const sectionId = (req.query.sectionId as string | undefined) ?? '';
  const date = (req.query.date as string | undefined) ?? '';

  const where: string[] = ['1=1'];
  const params: unknown[] = [];
  if (classId) {
    where.push('s.class_id = ?');
    params.push(classId);
  }
  if (sectionId) {
    where.push('s.section_id = ?');
    params.push(sectionId);
  }
  if (date) {
    where.push('s.date = ?');
    params.push(date);
  }

  const rows = db()
    .prepare(
      `SELECT s.*, c.name AS class_name, sec.name AS section_name,
              u.full_name AS taken_by_name,
              (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id) AS total_marked,
              (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'present') AS present_count,
              (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'absent') AS absent_count,
              (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'leave') AS leave_count
         FROM attendance_sessions s
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN sections sec ON sec.id = s.section_id
         LEFT JOIN users u ON u.id = s.taken_by
         WHERE ${where.join(' AND ')}
         ORDER BY s.date DESC, s.created_at DESC
         LIMIT 100`,
    )
    .all(...params);
  res.json({ items: rows });
});

router.post('/sessions', requirePerm('attendance.write'), (req, res, next) => {
  try {
    const body = openSessionSchema.parse(req.body);
    const dup = db()
      .prepare('SELECT id FROM attendance_sessions WHERE section_id = ? AND date = ?')
      .get(body.section_id, body.date);
    if (dup) throw new HttpError(409, 'session_exists', { sessionId: (dup as { id: string }).id });

    const newId = id('ats');
    db()
      .prepare(
        `INSERT INTO attendance_sessions (id, class_id, section_id, date, taken_by, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        body.class_id,
        body.section_id,
        body.date,
        req.user?.id ?? null,
        body.notes ?? null,
      );
    bus.publish(broadcastChannel(), { type: 'attendance.opened', sessionId: newId });
    res.status(201).json({ id: newId });
  } catch (e) {
    next(e);
  }
});

router.post('/sessions/:id/records', requirePerm('attendance.write'), (req, res, next) => {
  try {
    const body = bulkRecordsSchema.parse(req.body);
    const session = db()
      .prepare('SELECT id FROM attendance_sessions WHERE id = ?')
      .get(req.params.id);
    if (!session) throw new HttpError(404, 'session_not_found');

    const stmt = db().prepare(
      `INSERT INTO attendance_records (id, session_id, student_id, status, remarks)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_id, student_id) DO UPDATE SET
         status = excluded.status,
         remarks = excluded.remarks,
         marked_at = datetime('now')`,
    );

    const tx = db().transaction(() => {
      for (const r of body.records) {
        stmt.run(id('atr'), req.params.id, r.student_id, r.status, r.remarks ?? null);
      }
    });
    tx();

    bus.publish(broadcastChannel(), { type: 'attendance.saved', sessionId: req.params.id });
    res.json({ saved: body.records.length });
  } catch (e) {
    next(e);
  }
});

router.get('/sessions/:id', requirePerm('attendance.read'), (req, res, next) => {
  try {
    const session = db()
      .prepare(
        `SELECT s.*, c.name AS class_name, sec.name AS section_name
           FROM attendance_sessions s
           LEFT JOIN classes c ON c.id = s.class_id
           LEFT JOIN sections sec ON sec.id = s.section_id
           WHERE s.id = ?`,
      )
      .get(req.params.id);
    if (!session) throw new HttpError(404, 'not_found');
    const records = db()
      .prepare(
        `SELECT r.*, st.first_name, st.last_name, st.admission_no
           FROM attendance_records r
           INNER JOIN students st ON st.id = r.student_id
           WHERE r.session_id = ?
           ORDER BY st.first_name, st.last_name`,
      )
      .all(req.params.id);
    res.json({ session, records });
  } catch (e) {
    next(e);
  }
});

router.get('/students/:studentId', requirePerm('attendance.read'), (req, res) => {
  const from = (req.query.from as string | undefined) ?? '';
  const to = (req.query.to as string | undefined) ?? '';
  const where: string[] = ['ar.student_id = ?'];
  const params: unknown[] = [req.params.studentId];
  if (from) {
    where.push('s.date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('s.date <= ?');
    params.push(to);
  }
  const rows = db()
    .prepare(
      `SELECT s.date, ar.status, ar.remarks, sec.name AS section_name, c.name AS class_name
         FROM attendance_records ar
         INNER JOIN attendance_sessions s ON s.id = ar.session_id
         LEFT JOIN sections sec ON sec.id = s.section_id
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE ${where.join(' AND ')}
         ORDER BY s.date DESC
         LIMIT 365`,
    )
    .all(...params);
  res.json({ items: rows });
});

router.get('/summary', requirePerm('attendance.read'), (req, res) => {
  const date = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const rows = db()
    .prepare(
      `SELECT s.id, s.class_id, s.section_id, c.name AS class_name, sec.name AS section_name,
              (SELECT COUNT(*) FROM students st WHERE st.current_section_id = s.section_id AND st.status = 'active') AS expected,
              (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'present') AS present,
              (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'absent') AS absent,
              (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id AND r.status = 'leave') AS leave
         FROM attendance_sessions s
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN sections sec ON sec.id = s.section_id
         WHERE s.date = ?`,
    )
    .all(date);
  res.json({ date, items: rows });
});

export default router;