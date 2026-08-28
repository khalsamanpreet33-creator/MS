import { Router } from 'express';
import { db } from '../db/client.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/summary', requirePerm('dashboard.read'), (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  const totalStudents = (db()
    .prepare("SELECT COUNT(*) AS n FROM students WHERE status = 'active'")
    .get() as { n: number }).n;
  const totalClasses = (db()
    .prepare("SELECT COUNT(*) AS n FROM classes WHERE status = 'active'")
    .get() as { n: number }).n;
  const totalStaff = (db()
    .prepare('SELECT COUNT(*) AS n FROM users WHERE is_active = 1')
    .get() as { n: number }).n;

  const todayAttendance = db()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM attendance_sessions WHERE date = ?) AS sessions,
         (SELECT COUNT(*) FROM attendance_records r
            INNER JOIN attendance_sessions s ON s.id = r.session_id
            WHERE s.date = ? AND r.status = 'present') AS present,
         (SELECT COUNT(*) FROM attendance_records r
            INNER JOIN attendance_sessions s ON s.id = r.session_id
            WHERE s.date = ? AND r.status = 'absent') AS absent,
         (SELECT COUNT(*) FROM attendance_records r
            INNER JOIN attendance_sessions s ON s.id = r.session_id
            WHERE s.date = ? AND r.status = 'leave') AS leave`,
    )
    .get(today, today, today, today) as {
    sessions: number; present: number; absent: number; leave: number;
  };

  const fees = db()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_date = ? THEN amount ELSE 0 END), 0) AS today_collected,
         COALESCE(SUM(CASE WHEN payment_date >= ? THEN amount ELSE 0 END), 0) AS mtd_collected,
         (SELECT COALESCE(SUM(balance),0) FROM fee_invoices WHERE status IN ('unpaid','partial')) AS outstanding
         FROM fee_payments`,
    )
    .get(today, monthStart) as {
    today_collected: number; mtd_collected: number; outstanding: number;
  };

  // Attendance trend (last 14 days)
  const attendanceTrend = db()
    .prepare(
      `SELECT s.date,
              COALESCE(SUM(CASE WHEN r.status = 'present' THEN 1 ELSE 0 END), 0) AS present,
              COALESCE(SUM(CASE WHEN r.status = 'absent'  THEN 1 ELSE 0 END), 0) AS absent
         FROM attendance_sessions s
         LEFT JOIN attendance_records r ON r.session_id = s.id
         WHERE s.date >= date('now','-13 day')
         GROUP BY s.date
         ORDER BY s.date`,
    )
    .all() as { date: string; present: number; absent: number }[];

  const recentEvents = db()
    .prepare(
      `SELECT id, level, source, message, created_at
         FROM system_events
         ORDER BY created_at DESC LIMIT 10`,
    )
    .all();

  res.json({
    totals: {
      students: totalStudents,
      classes: totalClasses,
      staff: totalStaff,
    },
    attendance_today: todayAttendance,
    fees_today: fees,
    attendance_trend: attendanceTrend,
    recent_events: recentEvents,
  });
});

export default router;