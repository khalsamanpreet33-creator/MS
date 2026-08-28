import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface EmergencyAlert {
  id: string;
  title: string;
  body: string;
  severity: string;
  channels: string;
  status: string;
  created_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  creator_name?: string | null;
}

const alertSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  severity: z.enum(['info', 'warning', 'critical']).default('critical'),
  channels: z.string().min(1).max(100).default('inapp,sms,email,whatsapp'),
});

router.get('/', requirePerm('emergency.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT e.*, u.full_name AS creator_name
         FROM emergency_alerts e
         LEFT JOIN users u ON u.id = e.created_by
         ORDER BY e.created_at DESC
         LIMIT 100`,
    )
    .all() as EmergencyAlert[];
  res.json({ items: rows });
});

router.get('/active', requirePerm('emergency.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT e.*, u.full_name AS creator_name
         FROM emergency_alerts e
         LEFT JOIN users u ON u.id = e.created_by
         WHERE e.status = 'active'
         ORDER BY e.created_at DESC`,
    )
    .all() as EmergencyAlert[];
  res.json({ items: rows });
});

router.post('/', requirePerm('emergency.write'), (req, res, next) => {
  try {
    const body = alertSchema.parse(req.body);
    const newId = id('eml');
    db()
      .prepare(
        `INSERT INTO emergency_alerts (id, title, body, severity, channels, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.title, body.body, body.severity, body.channels, req.user!.id);

    // Fan-out to in-app notifications for all active users
    const channels = body.channels.split(',').map((s) => s.trim()).filter(Boolean);
    const users = db()
      .prepare(`SELECT id FROM users WHERE is_active = 1`)
      .all() as Array<{ id: string }>;
    if (channels.includes('inapp')) {
      const insertNotif = db().prepare(
        `INSERT INTO notifications (id, user_id, kind, title, body, link)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const u of users) {
        insertNotif.run(id('nfn'), u.id, 'alert', body.title, body.body, '/emergency');
      }
    }
    // Queue outbox rows for non-inapp channels (no recipient resolution here)
    const queueOutbox = db().prepare(
      `INSERT INTO communication_outbox (id, channel, recipient, subject, body, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const ch of channels) {
      if (ch === 'inapp') continue;
      queueOutbox.run(
        id('obx'),
        ch,
        'broadcast',
        body.title,
        body.body,
        JSON.stringify({ severity: body.severity, alert_id: newId }),
      );
    }
    res.status(201).json({ id: newId, recipients: users.length });
  } catch (e) { next(e); }
});

router.post('/:id/resolve', requirePerm('emergency.write'), (req, res) => {
  const exists = db().prepare('SELECT id FROM emergency_alerts WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'alert_not_found');
  db()
    .prepare(
      `UPDATE emergency_alerts SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`,
    )
    .run(req.user!.id, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/cancel', requirePerm('emergency.write'), (req, res) => {
  const exists = db().prepare('SELECT id FROM emergency_alerts WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'alert_not_found');
  db().prepare(`UPDATE emergency_alerts SET status = 'cancelled', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`)
    .run(req.user!.id, req.params.id);
  res.json({ ok: true });
});

export default router;
