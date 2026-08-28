import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Campaign {
  id: string;
  name: string;
  audience: string;
  channel: string;
  subject: string | null;
  body: string;
  total_recipients: number;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  creator_name?: string | null;
}

function resolveRecipients(audience: string): string[] {
  if (audience === 'all_parents') {
    return (db().prepare(`SELECT DISTINCT guardian_phone AS phone FROM students WHERE guardian_phone IS NOT NULL AND guardian_phone != ''`).all() as Array<{ phone: string }>)
      .map((r) => r.phone);
  }
  if (audience === 'all_staff') {
    return (db().prepare(`SELECT DISTINCT phone FROM users WHERE is_active = 1 AND phone IS NOT NULL AND phone != ''`).all() as Array<{ phone: string }>)
      .map((r) => r.phone);
  }
  if (audience === 'all_students') {
    return (db().prepare(`SELECT DISTINCT phone FROM students WHERE phone IS NOT NULL AND phone != ''`).all() as Array<{ phone: string }>)
      .map((r) => r.phone);
  }
  return [];
}

const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  audience: z.string().min(1).max(80),
  channel: z.enum(['sms', 'email', 'whatsapp', 'inapp']),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(5000),
  scheduled_at: z.string().min(8).optional(),
});

router.get('/', requirePerm('bulkcomm.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT c.*, u.full_name AS creator_name
         FROM bulk_campaigns c
         LEFT JOIN users u ON u.id = c.created_by
         ORDER BY c.created_at DESC LIMIT 100`,
    )
    .all() as Campaign[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('bulkcomm.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT c.*, u.full_name AS creator_name
         FROM bulk_campaigns c
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.id = ?`,
    )
    .get(req.params.id) as Campaign | undefined;
  if (!row) throw new HttpError(404, 'campaign_not_found');
  res.json(row);
});

router.post('/preview', requirePerm('bulkcomm.write'), (req, res, next) => {
  try {
    const schema = z.object({ audience: z.string().min(1) });
    const body = schema.parse(req.body);
    const recipients = resolveRecipients(body.audience);
    res.json({ audience: body.audience, count: recipients.length });
  } catch (e) { next(e); }
});

router.post('/', requirePerm('bulkcomm.write'), (req, res, next) => {
  try {
    const body = campaignSchema.parse(req.body);
    const newId = id('cmg');
    const recipients = resolveRecipients(body.audience);

    db()
      .prepare(
        `INSERT INTO bulk_campaigns (id, name, audience, channel, subject, body, total_recipients, status, scheduled_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', COALESCE(?, datetime('now')), ?)`,
      )
      .run(
        newId, body.name, body.audience, body.channel, body.subject ?? null,
        body.body, recipients.length, body.scheduled_at ?? null, req.user!.id,
      );

    // Queue outbox rows
    if (recipients.length > 0 && body.channel !== 'inapp') {
      const insertOutbox = db().prepare(
        `INSERT INTO communication_outbox (id, channel, recipient, subject, body, payload)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const r of recipients) {
        insertOutbox.run(
          id('obx'),
          body.channel,
          r,
          body.subject ?? null,
          body.body,
          JSON.stringify({ campaign_id: newId }),
        );
      }
    }
    res.status(201).json({ id: newId, recipients: recipients.length });
  } catch (e) { next(e); }
});

export default router;
