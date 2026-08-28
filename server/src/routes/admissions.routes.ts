import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface InquiryRow {
  id: string;
  name: string;
  parent_name: string | null;
  phone: string | null;
  email: string | null;
  applying_for_class_id: string | null;
  applying_for_class_name: string | null;
  source: string | null;
  status: 'new' | 'contacted' | 'reviewing' | 'accepted' | 'rejected' | 'waitlisted' | 'enrolled';
  notes: string | null;
  converted_student_id: string | null;
  has_application: number;
  created_at: string;
}

const inquirySchema = z.object({
  name: z.string().min(1).max(120),
  parent_name: z.string().max(120).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().max(120).nullable().optional().or(z.literal('')),
  applying_for_class_id: z.string().nullable().optional(),
  source: z.string().max(60).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

router.get('/inquiries', requirePerm('admissions.read'), (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (status) {
    where.push('i.status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT i.*, c.name AS applying_for_class_name,
              (SELECT COUNT(*) FROM admissions_applications a WHERE a.inquiry_id = i.id) AS has_application
         FROM admissions_inquiries i
         LEFT JOIN classes c ON c.id = i.applying_for_class_id
         ${clause} ORDER BY i.created_at DESC LIMIT 500`,
    )
    .all(...params) as InquiryRow[];
  res.json({ items: rows });
});

router.get('/inquiries/:id', requirePerm('admissions.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT i.*, c.name AS applying_for_class_name FROM admissions_inquiries i
         LEFT JOIN classes c ON c.id = i.applying_for_class_id WHERE i.id = ?`,
    )
    .get(req.params.id) as (InquiryRow & { applying_for_class_name: string | null }) | undefined;
  if (!row) throw new HttpError(404, 'inquiry_not_found');
  const application = db()
    .prepare('SELECT * FROM admissions_applications WHERE inquiry_id = ?')
    .get(req.params.id);
  res.json({ ...row, application });
});

router.post('/inquiries', requirePerm('admissions.write'), (req, res, next) => {
  try {
    const body = inquirySchema.parse(req.body);
    const newId = id('inq');
    db()
      .prepare(
        `INSERT INTO admissions_inquiries (id, name, parent_name, phone, email, applying_for_class_id, source, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId, body.name, body.parent_name ?? null, body.phone ?? null,
        body.email || null, body.applying_for_class_id ?? null, body.source ?? null, body.notes ?? null,
      );
    const row = db()
      .prepare(
        `SELECT i.*, c.name AS applying_for_class_name FROM admissions_inquiries i
           LEFT JOIN classes c ON c.id = i.applying_for_class_id WHERE i.id = ?`,
      )
      .get(newId);
    res.status(201).json(row);
  } catch (e) { next(e); }
});

const patchInquirySchema = inquirySchema.partial().extend({
  status: z.enum(['new', 'contacted', 'reviewing', 'accepted', 'rejected', 'waitlisted', 'enrolled']).optional(),
});

router.patch('/inquiries/:id', requirePerm('admissions.write'), (req, res, next) => {
  try {
    const body = patchInquirySchema.parse(req.body);
    const exists = db().prepare('SELECT id FROM admissions_inquiries WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'inquiry_not_found');

    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      name: 'name', parent_name: 'parent_name', phone: 'phone', email: 'email',
      applying_for_class_id: 'applying_for_class_id', source: 'source', notes: 'notes', status: 'status',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k] === '' ? null : (body as Record<string, unknown>)[k]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE admissions_inquiries SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    const row = db()
      .prepare(
        `SELECT i.*, c.name AS applying_for_class_name FROM admissions_inquiries i
           LEFT JOIN classes c ON c.id = i.applying_for_class_id WHERE i.id = ?`,
      )
      .get(req.params.id);
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/inquiries/:id', requirePerm('admissions.delete'), (req, res) => {
  const existing = db().prepare('SELECT id FROM admissions_inquiries WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'inquiry_not_found');
  db().prepare('DELETE FROM admissions_inquiries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Applications
const applicationSchema = z.object({
  inquiry_id: z.string().min(1),
  dob: z.string().max(20).nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  previous_school: z.string().max(200).nullable().optional(),
  documents_checklist: z.string().max(2000).nullable().optional(),
  test_score: z.number().min(0).nullable().optional(),
  test_date: z.string().max(20).nullable().optional(),
  interview_notes: z.string().max(2000).nullable().optional(),
});

router.put('/applications/:inquiryId', requirePerm('admissions.write'), (req, res, next) => {
  try {
    const body = applicationSchema.parse({ ...req.body, inquiry_id: req.params.inquiryId });
    const inq = db().prepare('SELECT id FROM admissions_inquiries WHERE id = ?').get(body.inquiry_id);
    if (!inq) throw new HttpError(404, 'inquiry_not_found');
    const existing = db().prepare('SELECT id FROM admissions_applications WHERE inquiry_id = ?').get(body.inquiry_id);
    if (existing) {
      db()
        .prepare(
          `UPDATE admissions_applications SET dob = ?, gender = ?, address = ?, previous_school = ?,
             documents_checklist = ?, test_score = ?, test_date = ?, interview_notes = ?, updated_at = datetime('now')
             WHERE inquiry_id = ?`,
        )
        .run(body.dob ?? null, body.gender ?? null, body.address ?? null, body.previous_school ?? null,
             body.documents_checklist ?? null, body.test_score ?? null, body.test_date ?? null,
             body.interview_notes ?? null, body.inquiry_id);
    } else {
      db()
        .prepare(
          `INSERT INTO admissions_applications (id, inquiry_id, dob, gender, address, previous_school,
             documents_checklist, test_score, test_date, interview_notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id('app'), body.inquiry_id, body.dob ?? null, body.gender ?? null, body.address ?? null,
             body.previous_school ?? null, body.documents_checklist ?? null, body.test_score ?? null,
             body.test_date ?? null, body.interview_notes ?? null);
      db().prepare(`UPDATE admissions_inquiries SET status = 'reviewing', updated_at = datetime('now') WHERE id = ?`)
        .run(body.inquiry_id);
    }
    const row = db().prepare('SELECT * FROM admissions_applications WHERE inquiry_id = ?').get(body.inquiry_id);
    res.json(row);
  } catch (e) { next(e); }
});

const decisionSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'waitlisted']),
  notes: z.string().max(500).nullable().optional(),
});

router.patch('/applications/:inquiryId/decision', requirePerm('admissions.write'), (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    const inq = db().prepare('SELECT id FROM admissions_inquiries WHERE id = ?').get(req.params.inquiryId);
    if (!inq) throw new HttpError(404, 'inquiry_not_found');
    db()
      .prepare(
        `UPDATE admissions_applications SET decision_date = datetime('now'), decision_by = ?, interview_notes = COALESCE(?, interview_notes)
           WHERE inquiry_id = ?`,
      )
      .run(req.user!.id, body.notes ?? null, req.params.inquiryId);
    db()
      .prepare(`UPDATE admissions_inquiries SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(body.status, req.params.inquiryId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Convert inquiry to student
const convertSchema = z.object({
  admission_no: z.string().min(1).max(40),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  section_id: z.string().nullable().optional(),
});

router.post('/inquiries/:id/convert', requirePerm('admissions.write'), (req, res, next) => {
  try {
    const body = convertSchema.parse(req.body);
    const inq = db().prepare('SELECT * FROM admissions_inquiries WHERE id = ?').get(req.params.id) as InquiryRow | undefined;
    if (!inq) throw new HttpError(404, 'inquiry_not_found');
    if (inq.status === 'enrolled') throw new HttpError(400, 'already_enrolled');

    const dup = db().prepare('SELECT id FROM students WHERE admission_no = ?').get(body.admission_no);
    if (dup) throw new HttpError(409, 'duplicate_admission_no');

    const app = db().prepare('SELECT * FROM admissions_applications WHERE inquiry_id = ?').get(req.params.id) as { dob: string | null; gender: string | null; address: string | null } | undefined;

    const newId = id('stu');
    const tx = db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO students (id, admission_no, first_name, last_name, date_of_birth, gender, address,
             guardian_name, guardian_phone, current_class_id, current_section_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        )
        .run(
          newId, body.admission_no, body.first_name, body.last_name,
          app?.dob ?? null, app?.gender ?? null, app?.address ?? null,
          inq.parent_name, inq.phone, inq.applying_for_class_id, body.section_id ?? null,
        );
      db()
        .prepare(`UPDATE admissions_inquiries SET status = 'enrolled', converted_student_id = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(newId, req.params.id);
    });
    tx();
    res.status(201).json({ id: newId, admission_no: body.admission_no });
  } catch (e) { next(e); }
});

export default router;
