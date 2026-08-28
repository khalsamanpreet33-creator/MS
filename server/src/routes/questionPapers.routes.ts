import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';
import { renderQuestionPaperPdf } from '../services/questionPaper.pdf.js';

const router = Router();
router.use(requireAuth);

interface PaperRow {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  title: string;
  instructions: string | null;
  duration_minutes: number | null;
  status: 'draft' | 'finalized';
  created_by: string | null;
  created_at: string;
  item_count: number;
  total_marks: number;
}

interface ItemRow {
  id: string;
  paper_id: string;
  question_id: string;
  sort_order: number;
  marks_override: number | null;
  question_text: string;
  question_type: string;
  options_json: string | null;
  marks: number;
  difficulty: string;
}

const paperSchema = z.object({
  subject_id: z.string().min(1),
  title: z.string().min(1).max(160),
  instructions: z.string().max(2000).nullable().optional(),
  duration_minutes: z.number().int().min(1).max(600).nullable().optional(),
});

function paperSelect(): string {
  return `
    SELECT p.id, p.subject_id, s.name AS subject_name, s.code AS subject_code,
           c.name AS class_name,
           p.title, p.instructions, p.duration_minutes, p.status, p.created_by, p.created_at,
           (SELECT COUNT(*) FROM question_paper_items i WHERE i.paper_id = p.id) AS item_count,
           COALESCE((
             SELECT SUM(COALESCE(i.marks_override, q.marks))
               FROM question_paper_items i
               JOIN question_bank q ON q.id = i.question_id
               WHERE i.paper_id = p.id
           ), 0) AS total_marks
      FROM question_papers p
      JOIN subjects s ON s.id = p.subject_id
      JOIN classes c ON c.id = s.class_id
  `;
}

router.get('/', requirePerm('exams.read'), (req, res) => {
  const subjectId = typeof req.query.subject_id === 'string' ? req.query.subject_id : undefined;
  const sql = subjectId
    ? `${paperSelect()} WHERE p.subject_id = ? ORDER BY p.created_at DESC`
    : `${paperSelect()} ORDER BY p.created_at DESC LIMIT 200`;
  const rows = (subjectId ? db().prepare(sql).all(subjectId) : db().prepare(sql).all()) as PaperRow[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('exams.read'), (req, res, next) => {
  const rows = db().prepare(`${paperSelect()} WHERE p.id = ?`).all(req.params.id) as PaperRow[];
  if (rows.length === 0) throw new HttpError(404, 'not_found');
  const items = db()
    .prepare(
      `SELECT i.id, i.paper_id, i.question_id, i.sort_order, i.marks_override,
              q.question_text, q.question_type, q.options_json, q.marks, q.difficulty
         FROM question_paper_items i
         JOIN question_bank q ON q.id = i.question_id
         WHERE i.paper_id = ?
         ORDER BY i.sort_order`,
    )
    .all(req.params.id) as ItemRow[];
  res.json({ ...rows[0], items: items.map((it) => ({ ...it, options: it.options_json ? safeJson(it.options_json) : null })) });
});

router.post('/', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = paperSchema.parse(req.body);
    const newId = id('qp');
    db()
      .prepare(
        `INSERT INTO question_papers (id, subject_id, title, instructions, duration_minutes, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.subject_id, body.title, body.instructions ?? null, body.duration_minutes ?? null, req.user?.id ?? null);
    const rows = db().prepare(`${paperSelect()} WHERE p.id = ?`).all(newId) as PaperRow[];
    res.status(201).json({ ...rows[0], items: [] });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = paperSchema.partial().parse(req.body);
    const existing = db().prepare('SELECT id FROM question_papers WHERE id = ?').get(req.params.id);
    if (!existing) throw new HttpError(404, 'not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    if (body.title !== undefined) { fields.push('title = ?'); params.push(body.title); }
    if (body.instructions !== undefined) { fields.push('instructions = ?'); params.push(body.instructions); }
    if (body.duration_minutes !== undefined) { fields.push('duration_minutes = ?'); params.push(body.duration_minutes); }
    if (body.subject_id !== undefined) { fields.push('subject_id = ?'); params.push(body.subject_id); }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    params.push(req.params.id);
    db().prepare(`UPDATE question_papers SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    const rows = db().prepare(`${paperSelect()} WHERE p.id = ?`).all(req.params.id) as PaperRow[];
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePerm('exams.write'), (req, res, next) => {
  const existing = db().prepare('SELECT id FROM question_papers WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'not_found');
  db().prepare('DELETE FROM question_papers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

const addItemSchema = z.object({
  question_id: z.string().min(1),
  sort_order: z.number().int().min(0).max(9999).default(0),
  marks_override: z.number().int().min(0).max(100).nullable().optional(),
});

router.post('/:id/items', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = addItemSchema.parse(req.body);
    const paper = db().prepare('SELECT id FROM question_papers WHERE id = ?').get(req.params.id);
    if (!paper) throw new HttpError(404, 'paper_not_found');
    const question = db().prepare('SELECT id FROM question_bank WHERE id = ?').get(body.question_id);
    if (!question) throw new HttpError(404, 'question_not_found');

    try {
      db()
        .prepare(
          `INSERT INTO question_paper_items (id, paper_id, question_id, sort_order, marks_override)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(id('qpi'), req.params.id, body.question_id, body.sort_order, body.marks_override ?? null);
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new HttpError(409, 'duplicate_question');
      }
      throw e;
    }
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/items/:itemId', requirePerm('exams.write'), (req, res, next) => {
  const item = db().prepare('SELECT id FROM question_paper_items WHERE id = ? AND paper_id = ?').get(req.params.itemId, req.params.id);
  if (!item) throw new HttpError(404, 'item_not_found');
  db().prepare('DELETE FROM question_paper_items WHERE id = ?').run(req.params.itemId);
  res.json({ ok: true });
});

router.get('/:id/pdf', requirePerm('exams.read'), async (req, res, next) => {
  try {
    const paper = db().prepare(`${paperSelect()} WHERE p.id = ?`).get(req.params.id) as PaperRow | undefined;
    if (!paper) throw new HttpError(404, 'not_found');
    const items = db()
      .prepare(
        `SELECT i.id, i.sort_order, i.marks_override,
                q.question_text, q.question_type, q.options_json, q.marks, q.difficulty
           FROM question_paper_items i
           JOIN question_bank q ON q.id = i.question_id
           WHERE i.paper_id = ?
           ORDER BY i.sort_order`,
      )
      .all(req.params.id) as ItemRow[];

    const settings = db().prepare('SELECT key, value FROM settings WHERE key LIKE \'school.%\'').all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    for (const r of settings) map[r.key] = r.value;

    const pdf = await renderQuestionPaperPdf({
      paper,
      items: items.map((it) => ({
        sort_order: it.sort_order,
        marks: it.marks_override ?? it.marks,
        question_text: it.question_text,
        question_type: it.question_type,
        options: it.options_json ? (safeJson(it.options_json) as string[] | null) : null,
      })),
      school: {
        name: map['school.name'] ?? 'School',
        academic_year: map['school.academic_year'] ?? '',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="paper-${paper.id}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (e) {
    next(e);
  }
});

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

export default router;
