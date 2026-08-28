import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Notification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const createSchema = z.object({
  user_id: z.string().min(1),
  kind: z.enum(['info', 'warning', 'success', 'alert', 'task', 'fee', 'attendance', 'exam']).default('info'),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).nullable().optional(),
  link: z.string().max(500).nullable().optional(),
});

// Per-user feed (current user)
router.get('/', requirePerm('notifications.read'), (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const rows = db()
    .prepare(
      `SELECT * FROM notifications
        WHERE user_id = ?
          AND (? = 0 OR read_at IS NULL)
        ORDER BY created_at DESC
        LIMIT 100`,
    )
    .all(req.user!.id, unreadOnly ? 1 : 0) as Notification[];
  const unread = (db()
    .prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`)
    .get(req.user!.id) as { n: number }).n;
  res.json({ items: rows, unread });
});

router.post('/', requirePerm('notifications.read'), (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const newId = id('nfn');
    db()
      .prepare(
        `INSERT INTO notifications (id, user_id, kind, title, body, link)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.user_id, body.kind, body.title, body.body ?? null, body.link ?? null);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.post('/mark-read', requirePerm('notifications.read'), (req, res, next) => {
  try {
    const schema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });
    const body = schema.parse(req.body);
    if (body.all) {
      db()
        .prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`)
        .run(req.user!.id);
    } else if (body.ids && body.ids.length) {
      const placeholders = body.ids.map(() => '?').join(',');
      db()
        .prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND id IN (${placeholders})`)
        .run(req.user!.id, ...body.ids);
    } else {
      throw new HttpError(400, 'ids_or_all_required');
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('notifications.read'), (req, res) => {
  const r = db().prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
  if (r.changes === 0) throw new HttpError(404, 'notification_not_found');
  res.json({ ok: true });
});

export default router;
