import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const classSchema = z.object({
  name: z.string().min(1).max(40),
  grade_level: z.number().int().min(0).max(20),
  academic_year: z.string().min(4),
  class_teacher_id: z.string().optional().or(z.literal('')),
});

const sectionSchema = z.object({
  name: z.string().min(1).max(20),
  capacity: z.number().int().min(1).max(200).default(40),
  class_teacher_id: z.string().optional().or(z.literal('')),
});

router.get('/', requirePerm('classes.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT c.*, u.full_name AS class_teacher_name,
              (SELECT COUNT(*) FROM sections s WHERE s.class_id = c.id AND s.status = 'active') AS section_count,
              (SELECT COUNT(*) FROM students st WHERE st.current_class_id = c.id AND st.status = 'active') AS student_count
         FROM classes c
         LEFT JOIN users u ON u.id = c.class_teacher_id
         WHERE c.status = 'active'
         ORDER BY c.grade_level, c.name`,
    )
    .all();
  res.json({ items: rows });
});

router.post('/', requirePerm('classes.write'), (req, res, next) => {
  try {
    const body = classSchema.parse(req.body);
    const dup = db()
      .prepare('SELECT id FROM classes WHERE name = ? AND academic_year = ?')
      .get(body.name, body.academic_year);
    if (dup) throw new HttpError(409, 'duplicate_class');

    const newId = id('cls');
    db()
      .prepare(
        `INSERT INTO classes (id, name, grade_level, academic_year, class_teacher_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        body.name,
        body.grade_level,
        body.academic_year,
        body.class_teacher_id || null,
      );
    const created = db().prepare('SELECT * FROM classes WHERE id = ?').get(newId);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePerm('classes.write'), (req, res, next) => {
  try {
    const body = classSchema.partial().parse(req.body);
    const existing = db().prepare('SELECT id FROM classes WHERE id = ?').get(req.params.id);
    if (!existing) throw new HttpError(404, 'not_found');

    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      fields.push(`${k} = ?`);
      params.push(v === '' ? null : v);
    }
    if (!fields.length) return res.json(db().prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id));
    fields.push(`updated_at = datetime('now')`);
    params.push(req.params.id);
    db().prepare(`UPDATE classes SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json(db().prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePerm('classes.write'), (req, res, next) => {
  try {
    const existing = db().prepare('SELECT id FROM classes WHERE id = ?').get(req.params.id);
    if (!existing) throw new HttpError(404, 'not_found');
    db()
      .prepare(`UPDATE classes SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`)
      .run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/sections', requirePerm('classes.read'), (req, res) => {
  const rows = db()
    .prepare(
      `SELECT s.*, u.full_name AS class_teacher_name,
              (SELECT COUNT(*) FROM students st WHERE st.current_section_id = s.id AND st.status = 'active') AS student_count
         FROM sections s
         LEFT JOIN users u ON u.id = s.class_teacher_id
         WHERE s.class_id = ? AND s.status = 'active'
         ORDER BY s.name`,
    )
    .all(req.params.id);
  res.json({ items: rows });
});

router.post('/:id/sections', requirePerm('classes.write'), (req, res, next) => {
  try {
    const body = sectionSchema.parse(req.body);
    const dup = db()
      .prepare('SELECT id FROM sections WHERE class_id = ? AND name = ?')
      .get(req.params.id, body.name);
    if (dup) throw new HttpError(409, 'duplicate_section');

    const newId = id('sec');
    db()
      .prepare(
        `INSERT INTO sections (id, class_id, name, capacity, class_teacher_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        req.params.id,
        body.name,
        body.capacity ?? 40,
        body.class_teacher_id || null,
      );
    const created = db().prepare('SELECT * FROM sections WHERE id = ?').get(newId);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.patch('/sections/:sectionId', requirePerm('classes.write'), (req, res, next) => {
  try {
    const body = sectionSchema.partial().parse(req.body);
    const existing = db()
      .prepare('SELECT id FROM sections WHERE id = ?')
      .get(req.params.sectionId);
    if (!existing) throw new HttpError(404, 'not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      fields.push(`${k} = ?`);
      params.push(v === '' ? null : v);
    }
    if (!fields.length) {
      return res.json(db().prepare('SELECT * FROM sections WHERE id = ?').get(req.params.sectionId));
    }
    fields.push(`updated_at = datetime('now')`);
    params.push(req.params.sectionId);
    db().prepare(`UPDATE sections SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json(db().prepare('SELECT * FROM sections WHERE id = ?').get(req.params.sectionId));
  } catch (e) {
    next(e);
  }
});

router.delete('/sections/:sectionId', requirePerm('classes.write'), (req, res, next) => {
  try {
    const existing = db()
      .prepare('SELECT id FROM sections WHERE id = ?')
      .get(req.params.sectionId);
    if (!existing) throw new HttpError(404, 'not_found');
    db()
      .prepare(`UPDATE sections SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`)
      .run(req.params.sectionId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/teachers/lookup', requirePerm('classes.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT DISTINCT u.id, u.full_name
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.name IN ('Teacher','Admin','Principal') AND u.is_active = 1
         ORDER BY u.full_name`,
    )
    .all();
  res.json({ items: rows });
});

export default router;