import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface ParentRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  address: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  student_count: number;
  created_at: string;
}

const parentSchema = z.object({
  full_name: z.string().min(1).max(120),
  email: z.string().email().max(120).nullable().optional().or(z.literal('')),
  phone: z.string().max(30).nullable().optional(),
  occupation: z.string().max(80).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.get('/', requirePerm('parents.read'), (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    where.push('(p.full_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ?)');
    const needle = `%${q}%`;
    params.push(needle, needle, needle);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM parent_student_links l WHERE l.parent_id = p.id) AS student_count
         FROM parent_profiles p ${clause} ORDER BY p.full_name LIMIT 500`,
    )
    .all(...params) as ParentRow[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('parents.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM parent_student_links l WHERE l.parent_id = p.id) AS student_count
         FROM parent_profiles p WHERE p.id = ?`,
    )
    .get(req.params.id) as ParentRow | undefined;
  if (!row) throw new HttpError(404, 'parent_not_found');
  const links = db()
    .prepare(
      `SELECT l.id, l.relation, l.is_primary, l.created_at,
              s.id AS student_id, s.admission_no, s.first_name, s.last_name, s.status AS student_status,
              c.name AS class_name, sec.name AS section_name
         FROM parent_student_links l
         JOIN students s ON s.id = l.student_id
         LEFT JOIN classes c ON c.id = s.current_class_id
         LEFT JOIN sections sec ON sec.id = s.current_section_id
         WHERE l.parent_id = ? ORDER BY l.is_primary DESC, s.first_name`,
    )
    .all(req.params.id);
  res.json({ ...row, students: links });
});

router.post('/', requirePerm('parents.write'), (req, res, next) => {
  try {
    const body = parentSchema.parse(req.body);
    const newId = id('par');
    db()
      .prepare(
        `INSERT INTO parent_profiles (id, full_name, email, phone, occupation, address, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.full_name, body.email || null, body.phone ?? null,
           body.occupation ?? null, body.address ?? null, body.status, body.notes ?? null);
    const row = db().prepare('SELECT * FROM parent_profiles WHERE id = ?').get(newId);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('parents.write'), (req, res, next) => {
  try {
    const body = parentSchema.partial().parse(req.body);
    const exists = db().prepare('SELECT id FROM parent_profiles WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'parent_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      full_name: 'full_name', email: 'email', phone: 'phone', occupation: 'occupation',
      address: 'address', status: 'status', notes: 'notes',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k] === '' ? null : (body as Record<string, unknown>)[k]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE parent_profiles SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    const row = db().prepare('SELECT * FROM parent_profiles WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('parents.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM parent_profiles WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'parent_not_found');
  db().prepare('DELETE FROM parent_profiles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Links
const linkSchema = z.object({
  student_id: z.string().min(1),
  relation: z.enum(['father', 'mother', 'guardian', 'other']).default('guardian'),
  is_primary: z.boolean().default(false),
});

router.post('/:id/links', requirePerm('parents.write'), (req, res, next) => {
  try {
    const body = linkSchema.parse(req.body);
    const parent = db().prepare('SELECT id FROM parent_profiles WHERE id = ?').get(req.params.id);
    if (!parent) throw new HttpError(404, 'parent_not_found');
    const student = db().prepare('SELECT id FROM students WHERE id = ?').get(body.student_id);
    if (!student) throw new HttpError(404, 'student_not_found');

    const newId = id('plnk');
    try {
      if (body.is_primary) {
        db().prepare('UPDATE parent_student_links SET is_primary = 0 WHERE parent_id = ?').run(req.params.id);
      }
      db()
        .prepare(`INSERT INTO parent_student_links (id, parent_id, student_id, relation, is_primary)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(newId, req.params.id, body.student_id, body.relation, body.is_primary ? 1 : 0);
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'link_exists');
      throw e;
    }
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.delete('/:id/links/:linkId', requirePerm('parents.write'), (req, res) => {
  const exists = db()
    .prepare('SELECT id FROM parent_student_links WHERE id = ? AND parent_id = ?')
    .get(req.params.linkId, req.params.id);
  if (!exists) throw new HttpError(404, 'link_not_found');
  db().prepare('DELETE FROM parent_student_links WHERE id = ?').run(req.params.linkId);
  res.json({ ok: true });
});

router.patch('/:id/links/:linkId/primary', requirePerm('parents.write'), (req, res) => {
  const exists = db()
    .prepare('SELECT id FROM parent_student_links WHERE id = ? AND parent_id = ?')
    .get(req.params.linkId, req.params.id);
  if (!exists) throw new HttpError(404, 'link_not_found');
  const tx = db().transaction(() => {
    db().prepare('UPDATE parent_student_links SET is_primary = 0 WHERE parent_id = ?').run(req.params.id);
    db().prepare('UPDATE parent_student_links SET is_primary = 1 WHERE id = ?').run(req.params.linkId);
  });
  tx();
  res.json({ ok: true });
});

export default router;
