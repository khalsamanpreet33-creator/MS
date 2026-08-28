import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface QuestionRow {
  id: string;
  subject_id: string;
  question_type: 'mcq' | 'short' | 'long' | 'numerical';
  difficulty: 'easy' | 'medium' | 'hard';
  question_text: string;
  options_json: string | null;
  correct_answer: string | null;
  marks: number;
  status: string;
  created_by: string | null;
  created_at: string;
}

const questionSchema = z.object({
  subject_id: z.string().min(1),
  question_type: z.enum(['mcq', 'short', 'long', 'numerical']),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  question_text: z.string().min(1).max(4000),
  options_json: z.string().nullable().optional(),
  correct_answer: z.string().max(2000).nullable().optional(),
  marks: z.number().int().min(1).max(100).default(1),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.get('/', requirePerm('exams.read'), (req, res) => {
  const subjectId = typeof req.query.subject_id === 'string' ? req.query.subject_id : undefined;
  const sql = subjectId
    ? `SELECT * FROM question_bank WHERE subject_id = ? AND status = 'active' ORDER BY created_at DESC`
    : `SELECT * FROM question_bank WHERE status = 'active' ORDER BY created_at DESC LIMIT 200`;
  const rows = (subjectId ? db().prepare(sql).all(subjectId) : db().prepare(sql).all()) as QuestionRow[];
  res.json({ items: rows.map(parseOptions) });
});

router.get('/:id', requirePerm('exams.read'), (req, res, next) => {
  const row = db().prepare('SELECT * FROM question_bank WHERE id = ?').get(req.params.id) as QuestionRow | undefined;
  if (!row) throw new HttpError(404, 'not_found');
  res.json(parseOptions(row));
});

router.post('/', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = questionSchema.parse(req.body);
    const newId = id('qb');
    db()
      .prepare(
        `INSERT INTO question_bank
          (id, subject_id, question_type, difficulty, question_text, options_json, correct_answer, marks, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.subject_id, body.question_type, body.difficulty, body.question_text,
           body.options_json ?? null, body.correct_answer ?? null, body.marks, body.status, req.user?.id ?? null);
    const created = db().prepare('SELECT * FROM question_bank WHERE id = ?').get(newId) as QuestionRow;
    res.status(201).json(parseOptions(created));
  } catch (e) {
    next(e);
  }
});

const patchSchema = questionSchema.partial();

router.patch('/:id', requirePerm('exams.write'), (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const existing = db().prepare('SELECT * FROM question_bank WHERE id = ?').get(req.params.id) as QuestionRow | undefined;
    if (!existing) throw new HttpError(404, 'not_found');

    const merged = {
      subject_id: body.subject_id ?? existing.subject_id,
      question_type: body.question_type ?? existing.question_type,
      difficulty: body.difficulty ?? existing.difficulty,
      question_text: body.question_text ?? existing.question_text,
      options_json: body.options_json !== undefined ? body.options_json : existing.options_json,
      correct_answer: body.correct_answer !== undefined ? body.correct_answer : existing.correct_answer,
      marks: body.marks ?? existing.marks,
      status: body.status ?? existing.status,
    };
    db()
      .prepare(
        `UPDATE question_bank
            SET subject_id = ?, question_type = ?, difficulty = ?, question_text = ?,
                options_json = ?, correct_answer = ?, marks = ?, status = ?, updated_at = datetime('now')
          WHERE id = ?`,
      )
      .run(merged.subject_id, merged.question_type, merged.difficulty, merged.question_text,
           merged.options_json, merged.correct_answer, merged.marks, merged.status, req.params.id);
    const updated = db().prepare('SELECT * FROM question_bank WHERE id = ?').get(req.params.id) as QuestionRow;
    res.json(parseOptions(updated));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePerm('exams.write'), (req, res, next) => {
  const existing = db().prepare('SELECT id FROM question_bank WHERE id = ?').get(req.params.id);
  if (!existing) throw new HttpError(404, 'not_found');
  db().prepare(`UPDATE question_bank SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

function parseOptions(row: QuestionRow): QuestionRow & { options: string[] | null } {
  let options: string[] | null = null;
  if (row.options_json) {
    try { options = JSON.parse(row.options_json); } catch { /* ignore */ }
  }
  return { ...row, options };
}

export default router;
