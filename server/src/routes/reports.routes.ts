import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Attendance summary for a date range (joins sessions + records)
router.get('/attendance', requirePerm('reports.read'), (req, res, next) => {
  try {
    const schema = z.object({ from: z.string().min(8), to: z.string().min(8) });
    const { from, to } = schema.parse(req.query);
    const rows = db()
      .prepare(
        `SELECT ar.status, COUNT(*) AS n FROM attendance_records ar
           JOIN attendance_sessions s ON s.id = ar.session_id
           WHERE s.date BETWEEN ? AND ?
           GROUP BY ar.status`,
      )
      .all(from, to);
    const total = (rows as Array<{ n: number }>).reduce((s, r) => s + r.n, 0);
    const byClass = db()
      .prepare(
        `SELECT COALESCE(c.name, 'Unassigned') AS class_name, sec.name AS section_name,
                ar.status, COUNT(*) AS n
           FROM attendance_records ar
           JOIN attendance_sessions s ON s.id = ar.session_id
           LEFT JOIN classes c ON c.id = s.class_id
           LEFT JOIN sections sec ON sec.id = s.section_id
           WHERE s.date BETWEEN ? AND ?
           GROUP BY c.name, sec.name, ar.status
           ORDER BY c.name, sec.name, ar.status`,
      )
      .all(from, to);
    res.json({ from, to, total, by_status: rows, by_class: byClass });
  } catch (e) { next(e); }
});

// Fee collection summary
router.get('/fees', requirePerm('reports.read'), (req, res, next) => {
  try {
    const schema = z.object({ from: z.string().min(8), to: z.string().min(8) });
    const { from, to } = schema.parse(req.query);
    const paid = db()
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n FROM fee_payments
          WHERE date(payment_date) BETWEEN ? AND ?`,
      )
      .get(from, to);
    const outstanding = db()
      .prepare(
        `SELECT COALESCE(SUM(balance), 0) AS total, COUNT(*) AS n FROM fee_invoices
          WHERE status NOT IN ('paid','cancelled')`,
      )
      .get();
    const byMode = db()
      .prepare(
        `SELECT payment_mode, COALESCE(SUM(amount),0) AS total, COUNT(*) AS n
           FROM fee_payments
           WHERE date(payment_date) BETWEEN ? AND ?
           GROUP BY payment_mode
           ORDER BY total DESC`,
      )
      .all(from, to);
    res.json({ from, to, paid, outstanding, by_mode: byMode });
  } catch (e) { next(e); }
});

// Student strength by class+section
router.get('/students/strength', requirePerm('reports.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT c.id AS class_id, c.name AS class_name, c.grade_level,
              sec.id AS section_id, sec.name AS section_name, sec.capacity,
              (SELECT COUNT(*) FROM students s WHERE s.current_class_id = c.id AND s.current_section_id = sec.id AND s.status = 'active') AS enrolled
         FROM classes c
         LEFT JOIN sections sec ON sec.class_id = c.id
         ORDER BY c.grade_level, sec.name`,
    )
    .all();
  res.json({ items: rows });
});

// Outstanding dues
router.get('/fees/outstanding', requirePerm('reports.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT fi.id, fi.invoice_no AS invoice_number,
              fi.total AS amount, fi.balance, fi.paid, fi.discount, fi.fine,
              fi.due_date, fi.status, fi.period_label,
              s.first_name, s.last_name, s.admission_no,
              c.name AS class_name, sec.name AS section_name,
              fs.name AS fee_structure, fs.amount AS structure_amount
         FROM fee_invoices fi
         JOIN students s ON s.id = fi.student_id
         LEFT JOIN classes c ON c.id = s.current_class_id
         LEFT JOIN sections sec ON sec.id = s.current_section_id
         LEFT JOIN fee_structures fs ON fs.id = fi.structure_id
         WHERE fi.status NOT IN ('paid','cancelled')
         ORDER BY fi.due_date ASC, fi.balance DESC
         LIMIT 500`,
    )
    .all();
  const total = (rows as Array<{ balance: number }>).reduce((s, r) => s + r.balance, 0);
  res.json({ items: rows, total });
});

// Dashboard summary
router.get('/dashboard', requirePerm('reports.read'), (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const students = (db().prepare(`SELECT COUNT(*) AS n FROM students WHERE status='active'`).get() as { n: number }).n;
  const staff = (db().prepare(`SELECT COUNT(*) AS n FROM users WHERE is_active=1`).get() as { n: number }).n;
  const todayAttendance = db()
    .prepare(
      `SELECT ar.status, COUNT(*) AS n FROM attendance_records ar
         JOIN attendance_sessions s ON s.id = ar.session_id
         WHERE s.date = ? GROUP BY ar.status`,
    )
    .all(today);
  const todayCollected = (db()
    .prepare(`SELECT COALESCE(SUM(amount),0) AS n FROM fee_payments WHERE date(payment_date) = ?`)
    .get(today) as { n: number }).n;
  const activeNotices = (db()
    .prepare(`SELECT COUNT(*) AS n FROM notices WHERE status='published' AND (expire_date IS NULL OR date(expire_date) >= date('now'))`)
    .get() as { n: number }).n;
  const openComplaints = (db()
    .prepare(`SELECT COUNT(*) AS n FROM complaints WHERE status NOT IN ('resolved','closed')`)
    .get() as { n: number }).n;
  res.json({ today, students, staff, today_attendance: todayAttendance, today_collected: todayCollected, active_notices: activeNotices, open_complaints: openComplaints });
});

export default router;
