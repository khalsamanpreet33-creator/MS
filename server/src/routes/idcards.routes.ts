import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface IdCardTemplate {
  id: string;
  name: string;
  audience: string;
  template_html: string;
  width_mm: number;
  height_mm: number;
  status: string;
}

const tplSchema = z.object({
  name: z.string().min(1).max(120),
  audience: z.enum(['student', 'staff']),
  template_html: z.string().min(1).max(20000),
  width_mm: z.number().int().positive().default(54),
  height_mm: z.number().int().positive().default(86),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.get('/', requirePerm('idcards.read'), (_req, res) => {
  const rows = db()
    .prepare('SELECT * FROM id_card_templates ORDER BY audience, name')
    .all() as IdCardTemplate[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('idcards.read'), (req, res, next) => {
  try {
    const row = db().prepare('SELECT * FROM id_card_templates WHERE id = ?').get(req.params.id) as IdCardTemplate | undefined;
    if (!row) throw new HttpError(404, 'template_not_found');
    res.json(row);
  } catch (e) { next(e); }
});

router.post('/', requirePerm('idcards.write'), (req, res, next) => {
  try {
    const body = tplSchema.parse(req.body);
    const newId = id('idt');
    db()
      .prepare(
        `INSERT INTO id_card_templates (id, name, audience, template_html, width_mm, height_mm, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.name, body.audience, body.template_html, body.width_mm, body.height_mm, body.status);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('idcards.write'), (req, res, next) => {
  try {
    const body = tplSchema.partial().parse(req.body);
    const existing = db().prepare('SELECT id FROM id_card_templates WHERE id = ?').get(req.params.id);
    if (!existing) throw new HttpError(404, 'template_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      name: 'name', audience: 'audience', template_html: 'template_html',
      width_mm: 'width_mm', height_mm: 'height_mm', status: 'status',
    };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE id_card_templates SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('idcards.write'), (req, res) => {
  const exists = db().prepare('SELECT id FROM id_card_templates WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'template_not_found');
  db().prepare('DELETE FROM id_card_templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;