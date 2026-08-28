import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  license_number: string;
  license_expiry: string | null;
  address: string | null;
  joining_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const driverSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().max(40).nullable().optional(),
  license_number: z.string().min(1).max(60),
  license_expiry: z.string().min(8).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  joining_date: z.string().min(8).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().max(2000).nullable().optional(),
});

router.get('/', requirePerm('drivers.read'), (_req, res) => {
  const rows = db().prepare(`SELECT * FROM drivers ORDER BY full_name`).all() as Driver[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('drivers.read'), (req, res) => {
  const row = db().prepare(`SELECT * FROM drivers WHERE id = ?`).get(req.params.id) as Driver | undefined;
  if (!row) throw new HttpError(404, 'driver_not_found');
  res.json(row);
});

router.post('/', requirePerm('drivers.write'), (req, res, next) => {
  try {
    const body = driverSchema.parse(req.body);
    const newId = id('drv');
    db()
      .prepare(
        `INSERT INTO drivers (id, full_name, phone, license_number, license_expiry, address, joining_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId, body.full_name, body.phone ?? null, body.license_number,
        body.license_expiry ?? null, body.address ?? null, body.joining_date ?? null,
        body.status, body.notes ?? null,
      );
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('drivers.write'), (req, res, next) => {
  try {
    const body = driverSchema.partial().parse(req.body);
    const exists = db().prepare(`SELECT id FROM drivers WHERE id = ?`).get(req.params.id);
    if (!exists) throw new HttpError(404, 'driver_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const cols = ['full_name','phone','license_number','license_expiry','address','joining_date','status','notes'] as const;
    for (const c of cols) {
      if ((body as Record<string, unknown>)[c] !== undefined) {
        fields.push(`${c} = ?`);
        params.push((body as Record<string, unknown>)[c]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE drivers SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('drivers.write'), (req, res) => {
  const r = db().prepare(`DELETE FROM drivers WHERE id = ?`).run(req.params.id);
  if (r.changes === 0) throw new HttpError(404, 'driver_not_found');
  res.json({ ok: true });
});

export default router;
