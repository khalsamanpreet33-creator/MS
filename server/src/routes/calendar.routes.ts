import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface CalendarItem {
  id: string;
  source: 'event' | 'holiday' | 'exam' | 'notice' | 'timetable';
  title: string;
  description: string | null;
  start: string;
  end: string | null;
  all_day: number;
  category: string | null;
  audience: string | null;
  location: string | null;
  meta: Record<string, unknown> | null;
}

// Aggregated feed across events, holidays, exams, notices, timetable —
// filters to a date range. Holidays surface for everyone; events show
// only when matching the caller's role or audience filter.
router.get('/', requirePerm('calendar.read'), (req, res, next) => {
  try {
    const schema = z.object({
      from: z.string().min(8),
      to: z.string().min(8),
      category: z.string().optional(),
      audience: z.string().optional(),
    });
    const { from, to, category, audience } = schema.parse(req.query);
    const items: CalendarItem[] = [];

    const events = db()
      .prepare(
        `SELECT id, title, description, category, start_date AS start, end_date AS end,
                start_time, end_time, location, audience, is_holiday
           FROM events
          WHERE ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?) OR (start_date <= ? AND end_date >= ?))
            AND (? IS NULL OR category = ? OR is_holiday = 1)
            AND (? IS NULL OR audience = ? OR audience = 'all')`,
      )
      .all(from, to, from, to, from, to, category, category, audience, audience);
    for (const e of events as Array<any>) {
      items.push({
        id: `event:${e.id}`,
        source: e.is_holiday ? 'holiday' : 'event',
        title: e.title,
        description: e.description,
        start: e.start_time ? `${e.start}T${e.start_time}` : e.start,
        end: e.end_time ? `${e.end ?? e.start}T${e.end_time}` : e.end ?? null,
        all_day: e.start_time ? 0 : 1,
        category: e.category,
        audience: e.audience,
        location: e.location,
        meta: null,
      });
    }

    const holidays = db()
      .prepare(`SELECT id, name, date, type FROM holidays WHERE date BETWEEN ? AND ?`)
      .all(from, to);
    for (const h of holidays as Array<any>) {
      items.push({
        id: `holiday:${h.id}`,
        source: 'holiday',
        title: h.name,
        description: `${h.type} holiday`,
        start: h.date,
        end: h.date,
        all_day: 1,
        category: 'holiday',
        audience: 'all',
        location: null,
        meta: { type: h.type },
      });
    }

    const exams = db()
      .prepare(
        `SELECT id, name, exam_date, class_id, subject_id, max_marks FROM exams
          WHERE exam_date BETWEEN ? AND ?`,
      )
      .all(from, to);
    for (const x of exams as Array<any>) {
      items.push({
        id: `exam:${x.id}`,
        source: 'exam',
        title: `${x.name} (Exam)`,
        description: x.max_marks ? `Max marks: ${x.max_marks}` : null,
        start: x.exam_date,
        end: x.exam_date,
        all_day: 1,
        category: 'exam',
        audience: null,
        location: null,
        meta: { class_id: x.class_id, subject_id: x.subject_id, max_marks: x.max_marks },
      });
    }

    const notices = db()
      .prepare(
        `SELECT id, title, body, publish_date AS start, expire_date AS end FROM notices
          WHERE status = 'published'
            AND ((publish_date BETWEEN ? AND ?) OR (expire_date BETWEEN ? AND ?))`,
      )
      .all(from, to, from, to);
    for (const n of notices as Array<any>) {
      items.push({
        id: `notice:${n.id}`,
        source: 'notice',
        title: n.title,
        description: n.body?.slice(0, 200) ?? null,
        start: n.start,
        end: n.end,
        all_day: 1,
        category: 'notice',
        audience: null,
        location: null,
        meta: null,
      });
    }

    items.sort((a, b) => a.start.localeCompare(b.start));
    res.json({ from, to, items });
  } catch (e) { next(e); }
});

// Quick "today" feed for dashboard widget
router.get('/today', requirePerm('calendar.read'), (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const events = db()
    .prepare(
      `SELECT id, title, start_date, is_holiday, audience FROM events
        WHERE start_date BETWEEN ? AND ? ORDER BY start_date`,
    )
    .all(today, tomorrow);
  const holidays = db().prepare(`SELECT id, name, date, type FROM holidays WHERE date BETWEEN ? AND ?`).all(today, tomorrow);
  res.json({ today, events, holidays });
});

export default router;
