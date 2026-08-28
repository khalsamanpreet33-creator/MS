import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface TeacherRow {
  user_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
  employee_code: string | null;
  qualification: string | null;
  joining_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  subject_count: number;
  class_count: number;
}

const profileSchema = z.object({
  employee_code: z.string().max(40).nullable().optional(),
  qualification: z.string().max(160).nullable().optional(),
  joining_date: z.string().max(20).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().max(2000).nullable().optional(),
});

router.get('/', requirePerm('teachers.read'), (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';

  const where: string[] = ["EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name = 'Teacher')"];
  const params: unknown[] = [];
  if (q) {
    where.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR tp.employee_code LIKE ?)');
    const needle = `%${q}%`;
    params.push(needle, needle, needle, needle);
  }
  if (status === 'active' || status === 'inactive') {
    where.push('COALESCE(tp.status, "active") = ?');
    params.push(status);
  }
  const clause = `WHERE ${where.join(' AND ')}`;
  const rows = db()
    .prepare(
      `SELECT u.id AS user_id, u.username, u.full_name, u.email, u.phone, u.is_active,
              tp.employee_code, tp.qualification, tp.joining_date,
              COALESCE(tp.status, 'active') AS status, tp.notes,
              (SELECT COUNT(*) FROM subjects s WHERE s.teacher_id = u.id) AS subject_count,
              (SELECT COUNT(*) FROM classes c WHERE c.class_teacher_id = u.id) AS class_count
         FROM users u
         LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
         ${clause}
         ORDER BY u.full_name LIMIT 500`,
    )
    .all(...params) as TeacherRow[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('teachers.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT u.id AS user_id, u.username, u.full_name, u.email, u.phone, u.is_active, u.last_login_at,
              tp.employee_code, tp.qualification, tp.joining_date,
              COALESCE(tp.status, 'active') AS status, tp.notes,
              (SELECT COUNT(*) FROM subjects s WHERE s.teacher_id = u.id) AS subject_count,
              (SELECT COUNT(*) FROM classes c WHERE c.class_teacher_id = u.id) AS class_count
         FROM users u
         LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
         WHERE u.id = ?`,
    )
    .get(req.params.id) as TeacherRow | undefined;
  if (!row) throw new HttpError(404, 'teacher_not_found');

  const subjects = db()
    .prepare(
      `SELECT s.id, s.code, s.name, s.status, c.name AS class_name
         FROM subjects s JOIN classes c ON c.id = s.class_id
         WHERE s.teacher_id = ? ORDER BY c.name, s.name`,
    )
    .all(req.params.id);

  const classesLed = db()
    .prepare(
      `SELECT id, name FROM classes WHERE class_teacher_id = ? ORDER BY name`,
    )
    .all(req.params.id);

  res.json({ ...row, subjects, classes_led: classesLed });
});

router.patch('/:id', requirePerm('teachers.write'), (req, res, next) => {
  try {
    const body = profileSchema.parse(req.body);
    const exists = db().prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'teacher_not_found');

    const existing = db().prepare('SELECT user_id FROM teacher_profiles WHERE user_id = ?').get(req.params.id);
    const merged = {
      employee_code: body.employee_code ?? (existing ? null : null),
      qualification: body.qualification ?? null,
      joining_date: body.joining_date ?? null,
      status: body.status ?? 'active',
      notes: body.notes ?? null,
    };

    try {
      if (existing) {
        const fields: string[] = [];
        const params: unknown[] = [];
        const map: Record<string, string> = {
          employee_code: 'employee_code',
          qualification: 'qualification',
          joining_date: 'joining_date',
          status: 'status',
          notes: 'notes',
        };
        for (const [key, col] of Object.entries(map)) {
          if ((body as Record<string, unknown>)[key] !== undefined) {
            fields.push(`${col} = ?`);
            params.push((body as Record<string, unknown>)[key] === '' ? null : (body as Record<string, unknown>)[key]);
          }
        }
        if (fields.length > 0) {
          fields.push(`updated_at = datetime('now')`);
          db().prepare(`UPDATE teacher_profiles SET ${fields.join(', ')} WHERE user_id = ?`).run(...params, req.params.id);
        }
      } else {
        db()
          .prepare(
            `INSERT INTO teacher_profiles (user_id, employee_code, qualification, joining_date, status, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            req.params.id,
            merged.employee_code ?? null,
            merged.qualification ?? null,
            merged.joining_date ?? null,
            merged.status,
            merged.notes ?? null,
          );
      }
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'duplicate_employee_code');
      throw e;
    }
    const updated = db()
      .prepare(
        `SELECT u.id AS user_id, u.username, u.full_name, u.email, u.phone,
                tp.employee_code, tp.qualification, tp.joining_date,
                COALESCE(tp.status, 'active') AS status, tp.notes
           FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id = u.id WHERE u.id = ?`,
      )
      .get(req.params.id);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePerm('teachers.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'teacher_not_found');
  db()
    .prepare(`UPDATE teacher_profiles SET status = 'inactive', updated_at = datetime('now') WHERE user_id = ?`)
    .run(req.params.id);
  res.json({ ok: true });
});

export default router;
