import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface StaffRow {
  id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  joining_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
}

const staffSchema = z.object({
  employee_code: z.string().min(1).max(40),
  full_name: z.string().min(1).max(120),
  department: z.string().max(60).nullable().optional(),
  designation: z.string().max(80).nullable().optional(),
  email: z.string().email().max(120).nullable().optional().or(z.literal('')),
  phone: z.string().max(30).nullable().optional(),
  joining_date: z.string().max(20).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().max(2000).nullable().optional(),
});

const docSchema = z.object({
  doc_type: z.string().min(1).max(40),
  title: z.string().min(1).max(160),
  notes: z.string().max(500).nullable().optional(),
  file_path: z.string().max(500).nullable().optional(),
});

router.get('/', requirePerm('staff.read'), (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const department = typeof req.query.department === 'string' ? req.query.department.trim() : '';

  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    where.push('(s.full_name LIKE ? OR s.employee_code LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)');
    const needle = `%${q}%`;
    params.push(needle, needle, needle, needle);
  }
  if (status === 'active' || status === 'inactive') {
    where.push('s.status = ?');
    params.push(status);
  }
  if (department) {
    where.push('s.department = ?');
    params.push(department);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM staff_documents d WHERE d.staff_id = s.id) AS document_count
         FROM staff s ${clause} ORDER BY s.full_name LIMIT 500`,
    )
    .all(...params) as StaffRow[];
  res.json({ items: rows });
});

router.get('/departments', requirePerm('staff.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT department AS name, COUNT(*) AS count FROM staff
         WHERE department IS NOT NULL AND department <> ''
         GROUP BY department ORDER BY department`,
    )
    .all() as { name: string; count: number }[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('staff.read'), (req, res) => {
  const rows = db()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM staff_documents d WHERE d.staff_id = s.id) AS document_count
         FROM staff s WHERE s.id = ?`,
    )
    .all(req.params.id) as StaffRow[];
  if (rows.length === 0) throw new HttpError(404, 'not_found');
  const docs = db()
    .prepare('SELECT id, doc_type, title, file_path, notes, uploaded_at, uploaded_by FROM staff_documents WHERE staff_id = ? ORDER BY uploaded_at DESC')
    .all(req.params.id);
  res.json({ ...rows[0], documents: docs });
});

router.post('/', requirePerm('staff.write'), (req, res, next) => {
  try {
    const body = staffSchema.parse(req.body);
    const newId = id('staff');
    try {
      db()
        .prepare(
          `INSERT INTO staff (id, employee_code, full_name, department, designation, email, phone, joining_date, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newId,
          body.employee_code,
          body.full_name,
          body.department ?? null,
          body.designation ?? null,
          body.email || null,
          body.phone ?? null,
          body.joining_date ?? null,
          body.status,
          body.notes ?? null,
        );
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'duplicate_employee_code');
      throw e;
    }
    const rows = db()
        .prepare('SELECT *, 0 AS document_count FROM staff WHERE id = ?')
        .get(newId) as StaffRow;
    res.status(201).json(rows);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePerm('staff.write'), (req, res, next) => {
  try {
    const body = staffSchema.partial().parse(req.body);
    const existing = db().prepare('SELECT id FROM staff WHERE id = ?').get(req.params.id);
    if (!existing) throw new HttpError(404, 'not_found');

    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      employee_code: 'employee_code',
      full_name: 'full_name',
      department: 'department',
      designation: 'designation',
      email: 'email',
      phone: 'phone',
      joining_date: 'joining_date',
      status: 'status',
      notes: 'notes',
    };
    for (const [key, col] of Object.entries(map)) {
      const v = (body as Record<string, unknown>)[key];
      if (v !== undefined) {
        fields.push(`${col} = ?`);
        params.push(v === '' ? null : v);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    params.push(req.params.id);

    try {
      db().prepare(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'duplicate_employee_code');
      throw e;
    }
    const rows = db()
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM staff_documents d WHERE d.staff_id = s.id) AS document_count
           FROM staff s WHERE s.id = ?`,
      )
      .get(req.params.id) as StaffRow;
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePerm('staff.delete'), (req, res) => {
  const existing = db().prepare('SELECT id FROM staff WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'not_found');
  db().prepare(`UPDATE staff SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// Documents
router.post('/:id/documents', requirePerm('staff.write'), (req, res, next) => {
  try {
    const body = docSchema.parse(req.body);
    const staffExists = db().prepare('SELECT id FROM staff WHERE id = ?').get(req.params.id);
    if (!staffExists) throw new HttpError(404, 'staff_not_found');
    const newId = id('std');
    db()
      .prepare(
        `INSERT INTO staff_documents (id, staff_id, doc_type, title, file_path, notes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, req.params.id, body.doc_type, body.title, body.file_path ?? null, body.notes ?? null, req.user?.id ?? null);
    const doc = db().prepare('SELECT id, doc_type, title, file_path, notes, uploaded_at, uploaded_by FROM staff_documents WHERE id = ?').get(newId);
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/documents/:docId', requirePerm('staff.write'), (req, res) => {
  const doc = db()
    .prepare('SELECT id FROM staff_documents WHERE id = ? AND staff_id = ?')
    .get(req.params.docId, req.params.id);
  if (!doc) throw new HttpError(404, 'document_not_found');
  db().prepare('DELETE FROM staff_documents WHERE id = ?').run(req.params.docId);
  res.json({ ok: true });
});

export default router;