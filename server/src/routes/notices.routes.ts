import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Notice {
  id: string;
  title: string;
  body: string;
  category: string;
  audience: string;
  pinned: number;
  publish_date: string;
  expire_date: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
}

const noticeSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  category: z.enum(['general', 'academic', 'event', 'holiday', 'urgent', 'sports', 'transport']).default('general'),
  audience: z.enum(['all', 'students', 'parents', 'staff', 'teachers']).default('all'),
  pinned: z.boolean().default(false),
  publish_date: z.string().min(8).optional(),
  expire_date: z.string().min(8).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
});

router.get('/', requirePerm('notices.read'), (req, res) => {
  const audience = (req.query.audience as string | undefined) ?? null;
  const status = (req.query.status as string | undefined) ?? 'published';
  const rows = db()
    .prepare(
      `SELECT n.*, u.full_name AS author_name
         FROM notices n
         LEFT JOIN users u ON u.id = n.created_by
        WHERE (? IS NULL OR n.audience = ? OR n.audience = 'all')
          AND (? = 'all' OR n.status = ?)
        ORDER BY n.pinned DESC, n.publish_date DESC
        LIMIT 200`,
    )
    .all(audience, audience, status, status) as Notice[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('notices.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT n.*, u.full_name AS author_name
         FROM notices n LEFT JOIN users u ON u.id = n.created_by
         WHERE n.id = ?`,
    )
    .get(req.params.id) as Notice | undefined;
  if (!row) throw new HttpError(404, 'notice_not_found');
  res.json(row);
});

router.post('/', requirePerm('notices.write'), (req, res, next) => {
  try {
    const body = noticeSchema.parse(req.body);
    const newId = id('nte');
    db()
      .prepare(
        `INSERT INTO notices (id, title, body, category, audience, pinned, publish_date, expire_date, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?)`,
      )
      .run(
        newId, body.title, body.body, body.category, body.audience,
        body.pinned ? 1 : 0, body.publish_date ?? null,
        body.expire_date ?? null, body.status, req.user!.id,
      );
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('notices.write'), (req, res, next) => {
  try {
    const body = noticeSchema.partial().parse(req.body);
    const exists = db().prepare('SELECT id FROM notices WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'notice_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      title: 'title', body: 'body', category: 'category', audience: 'audience',
      publish_date: 'publish_date', expire_date: 'expire_date', status: 'status',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k]);
      }
    }
    if (body.pinned !== undefined) {
      fields.push('pinned = ?');
      params.push(body.pinned ? 1 : 0);
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE notices SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('notices.write'), (req, res) => {
  const exists = db().prepare('SELECT id FROM notices WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'notice_not_found');
  db().prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
