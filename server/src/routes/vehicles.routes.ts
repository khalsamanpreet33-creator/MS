import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Vehicle {
  id: string;
  vehicle_number: string;
  type: string;
  capacity: number;
  make_model: string | null;
  year: number | null;
  fuel_type: string | null;
  insurance_expiry: string | null;
  fitness_expiry: string | null;
  permit_expiry: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const vehicleSchema = z.object({
  vehicle_number: z.string().min(1).max(40),
  type: z.enum(['bus', 'van', 'car', 'minibus']).default('bus'),
  capacity: z.number().int().min(1).max(200).default(40),
  make_model: z.string().max(120).nullable().optional(),
  year: z.number().int().min(1990).max(2100).nullable().optional(),
  fuel_type: z.string().max(40).nullable().optional(),
  insurance_expiry: z.string().min(8).nullable().optional(),
  fitness_expiry: z.string().min(8).nullable().optional(),
  permit_expiry: z.string().min(8).nullable().optional(),
  status: z.enum(['active', 'maintenance', 'retired']).default('active'),
  notes: z.string().max(2000).nullable().optional(),
});

router.get('/', requirePerm('vehicles.read'), (_req, res) => {
  const rows = db()
    .prepare(`SELECT * FROM vehicles ORDER BY vehicle_number`)
    .all() as Vehicle[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('vehicles.read'), (req, res) => {
  const row = db().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(req.params.id) as Vehicle | undefined;
  if (!row) throw new HttpError(404, 'vehicle_not_found');
  res.json(row);
});

router.post('/', requirePerm('vehicles.write'), (req, res, next) => {
  try {
    const body = vehicleSchema.parse(req.body);
    const newId = id('veh');
    db()
      .prepare(
        `INSERT INTO vehicles (id, vehicle_number, type, capacity, make_model, year, fuel_type,
                               insurance_expiry, fitness_expiry, permit_expiry, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId, body.vehicle_number, body.type, body.capacity,
        body.make_model ?? null, body.year ?? null, body.fuel_type ?? null,
        body.insurance_expiry ?? null, body.fitness_expiry ?? null, body.permit_expiry ?? null,
        body.status, body.notes ?? null,
      );
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('vehicles.write'), (req, res, next) => {
  try {
    const body = vehicleSchema.partial().parse(req.body);
    const exists = db().prepare(`SELECT id FROM vehicles WHERE id = ?`).get(req.params.id);
    if (!exists) throw new HttpError(404, 'vehicle_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const cols = ['vehicle_number','type','capacity','make_model','year','fuel_type',
                  'insurance_expiry','fitness_expiry','permit_expiry','status','notes'] as const;
    for (const c of cols) {
      if ((body as Record<string, unknown>)[c] !== undefined) {
        fields.push(`${c} = ?`);
        params.push((body as Record<string, unknown>)[c]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('vehicles.write'), (req, res) => {
  const r = db().prepare(`DELETE FROM vehicles WHERE id = ?`).run(req.params.id);
  if (r.changes === 0) throw new HttpError(404, 'vehicle_not_found');
  res.json({ ok: true });
});

export default router;
