import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const documentSchema = z.object({
  title: z.string().min(1).max(160),
  document_type: z.string().min(1).max(40),
  related_to: z.enum(['student', 'staff', 'general']),
  related_id: z.string().nullable().optional(),
  file_path: z.string().min(1).max(500),
  file_size: z.number().int().nonnegative().nullable().optional(),
  mime_type: z.string().max(80).nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

router.get('/', requirePerm('documents.read'), (req, res) => {
  const relatedTo = typeof req.query.relatedTo === 'string' ? req.query.relatedTo : '';
  const relatedId = typeof req.query.relatedId === 'string' ? req.query.relatedId : '';
  const expiring = req.query.expiring === '1';
  const where: string[] = [];
  const params: unknown[] = [];
  if (relatedTo) { where.push('d.related_to = ?'); params.push(relatedTo); }
  if (relatedId) { where.push('d.related_id = ?'); params.push(relatedId); }
  if (expiring) {
    where.push("d.expiry_date IS NOT NULL AND d.expiry_date <= date('now', '+30 days')");
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT d.*, u.full_name AS uploaded_by_name FROM documents d
         LEFT JOIN users u ON u.id = d.uploaded_by
         ${clause}
         ORDER BY d.uploaded_at DESC LIMIT 200`,
    )
    .all(...params);
  res.json({ items: rows });
});

router.post('/', requirePerm('documents.write'), (req, res, next) => {
  try {
    const body = documentSchema.parse(req.body);
    const newId = id('doc');
    db()
      .prepare(
        `INSERT INTO documents (id, title, document_type, related_to, related_id, file_path, file_size, mime_type, expiry_date, notes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.title, body.document_type, body.related_to, body.related_id ?? null,
           body.file_path, body.file_size ?? null, body.mime_type ?? null,
           body.expiry_date ?? null, body.notes ?? null, req.user!.id);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('documents.write'), (req, res, next) => {
  try {
    const body = documentSchema.partial().parse(req.body);
    const exists = db().prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'document_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      title: 'title', document_type: 'document_type', related_to: 'related_to',
      related_id: 'related_id', file_path: 'file_path', file_size: 'file_size',
      mime_type: 'mime_type', expiry_date: 'expiry_date', notes: 'notes',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k] === '' ? null : (body as Record<string, unknown>)[k]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    db().prepare(`UPDATE documents SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('documents.delete'), (req, res) => {
  const exists = db().prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'document_not_found');
  db().prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;