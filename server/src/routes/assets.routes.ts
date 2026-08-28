import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Asset {
  id: string;
  asset_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  purchase_date: string;
  purchase_cost: number;
  current_value: number;
  location: string | null;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  status: string;
  depreciation_rate: number | null;
  notes: string | null;
}

interface Assignment {
  id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  assigned_to_type: string;
  assigned_to_id: string;
  assigned_to_name: string;
  assigned_at: string;
  returned_at: string | null;
  returned_condition: string | null;
  notes: string | null;
}

const assetSchema = z.object({
  asset_code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category_id: z.string().nullable().optional(),
  vendor_id: z.string().nullable().optional(),
  purchase_date: z.string().min(8),
  purchase_cost: z.number().min(0).default(0),
  location: z.string().max(100).nullable().optional(),
  depreciation_rate: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(['active', 'maintenance', 'retired', 'disposed', 'lost']).default('active'),
  notes: z.string().max(2000).nullable().optional(),
});

const assignSchema = z.object({
  assigned_to_type: z.enum(['student', 'staff', 'department', 'room']),
  assigned_to_id: z.string().min(1),
  assigned_to_name: z.string().min(1).max(200),
  notes: z.string().max(500).nullable().optional(),
});

// Categories
router.get('/categories', requirePerm('assets.read'), (_req, res) => {
  const rows = db().prepare(`SELECT * FROM asset_categories ORDER BY name`).all();
  res.json({ items: rows });
});

router.post('/categories', requirePerm('assets.write'), (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(80), depreciation_rate: z.number().min(0).max(100).default(10) });
    const body = schema.parse(req.body);
    const newId = id('ast_cat');
    db().prepare(`INSERT INTO asset_categories (id, name, depreciation_rate) VALUES (?, ?, ?)`).run(newId, body.name, body.depreciation_rate);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

// Assets
router.get('/', requirePerm('assets.read'), (req, res) => {
  const status = (req.query.status as string | undefined) ?? null;
  const rows = db()
    .prepare(
      `SELECT a.*, c.name AS category_name, v.name AS vendor_name FROM assets a
         LEFT JOIN asset_categories c ON c.id = a.category_id
         LEFT JOIN vendors v ON v.id = a.vendor_id
        WHERE (? IS NULL OR a.status = ?)
        ORDER BY a.purchase_date DESC LIMIT 200`,
    )
    .all(status, status) as Asset[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('assets.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT a.*, c.name AS category_name, v.name AS vendor_name FROM assets a
         LEFT JOIN asset_categories c ON c.id = a.category_id
         LEFT JOIN vendors v ON v.id = a.vendor_id
         WHERE a.id = ?`,
    )
    .get(req.params.id) as Asset | undefined;
  if (!row) throw new HttpError(404, 'asset_not_found');
  const history = db()
    .prepare(`SELECT * FROM asset_assignments WHERE asset_id = ? ORDER BY assigned_at DESC`)
    .all(req.params.id);
  const dep = db()
    .prepare(`SELECT * FROM depreciation_log WHERE asset_id = ? ORDER BY period_year DESC`)
    .all(req.params.id);
  res.json({ ...row, history, depreciation: dep });
});

router.post('/', requirePerm('assets.write'), (req, res, next) => {
  try {
    const body = assetSchema.parse(req.body);
    const newId = id('ast');
    db()
      .prepare(
        `INSERT INTO assets (id, asset_code, name, description, category_id, vendor_id, purchase_date, purchase_cost, current_value, location, depreciation_rate, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.asset_code, body.name, body.description ?? null,
           body.category_id ?? null, body.vendor_id ?? null,
           body.purchase_date, body.purchase_cost, body.purchase_cost,
           body.location ?? null, body.depreciation_rate ?? null,
           body.status, body.notes ?? null);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('assets.write'), (req, res, next) => {
  try {
    const body = assetSchema.partial().parse(req.body);
    const exists = db().prepare(`SELECT id FROM assets WHERE id = ?`).get(req.params.id);
    if (!exists) throw new HttpError(404, 'asset_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const cols = ['asset_code','name','description','category_id','vendor_id','purchase_date','purchase_cost','location','depreciation_rate','status','notes'] as const;
    for (const c of cols) {
      if ((body as Record<string, unknown>)[c] !== undefined) {
        fields.push(`${c} = ?`);
        params.push((body as Record<string, unknown>)[c]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('assets.write'), (req, res) => {
  const r = db().prepare(`DELETE FROM assets WHERE id = ?`).run(req.params.id);
  if (r.changes === 0) throw new HttpError(404, 'asset_not_found');
  res.json({ ok: true });
});

// Assignment
router.post('/:id/assign', requirePerm('assets.write'), (req, res, next) => {
  try {
    const body = assignSchema.parse(req.body);
    const asset = db().prepare(`SELECT status FROM assets WHERE id = ?`).get(req.params.id) as { status: string } | undefined;
    if (!asset) throw new HttpError(404, 'asset_not_found');
    if (asset.status !== 'active') throw new HttpError(400, 'asset_not_assignable');
    const newId = id('aa');
    const tx = db().transaction(() => {
      // Close any open assignment
      db().prepare(
        `UPDATE asset_assignments SET returned_at = datetime('now'), returned_condition = 'reassigned'
         WHERE asset_id = ? AND returned_at IS NULL`,
      ).run(req.params.id);
      db()
        .prepare(
          `INSERT INTO asset_assignments (id, asset_id, assigned_to_type, assigned_to_id, assigned_to_name, assigned_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(newId, req.params.id, body.assigned_to_type, body.assigned_to_id,
             body.assigned_to_name, req.user!.id, body.notes ?? null);
      db()
        .prepare(
          `UPDATE assets SET assigned_to_type = ?, assigned_to_id = ?, assigned_to_name = ?, assigned_at = datetime('now') WHERE id = ?`,
        )
        .run(body.assigned_to_type, body.assigned_to_id, body.assigned_to_name, req.params.id);
    });
    tx();
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.post('/:id/return', requirePerm('assets.write'), (req, res, next) => {
  try {
    const schema = z.object({ condition: z.string().max(80).nullable().optional() });
    const body = schema.parse(req.body);
    const r = db()
      .prepare(
        `UPDATE asset_assignments SET returned_at = datetime('now'), returned_condition = ?
         WHERE asset_id = ? AND returned_at IS NULL`,
      )
      .run(body.condition ?? 'good', req.params.id);
    if (r.changes === 0) throw new HttpError(400, 'no_open_assignment');
    db()
      .prepare(
        `UPDATE assets SET assigned_to_type = NULL, assigned_to_id = NULL, assigned_to_name = NULL, assigned_at = NULL WHERE id = ?`,
      )
      .run(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Depreciation
router.post('/:id/depreciate', requirePerm('assets.write'), (req, res, next) => {
  try {
    const schema = z.object({ period_year: z.number().int().min(2000).max(2100) });
    const body = schema.parse(req.body);
    const asset = db().prepare(`SELECT current_value, depreciation_rate FROM assets WHERE id = ?`).get(req.params.id) as { current_value: number; depreciation_rate: number | null } | undefined;
    if (!asset) throw new HttpError(404, 'asset_not_found');
    const rate = asset.depreciation_rate ?? 10;
    const amount = Math.round(asset.current_value * rate) / 100;
    const newValue = Math.max(0, asset.current_value - amount);
    const newId = id('dep');
    const tx = db().transaction(() => {
      db()
        .prepare(`INSERT INTO depreciation_log (id, asset_id, period_year, amount, book_value_after) VALUES (?, ?, ?, ?, ?)`)
        .run(newId, req.params.id, body.period_year, amount, newValue);
      db().prepare(`UPDATE assets SET current_value = ?, updated_at = datetime('now') WHERE id = ?`).run(newValue, req.params.id);
    });
    tx();
    res.json({ ok: true, amount, new_value: newValue });
  } catch (e) { next(e); }
});

router.get('/:id/assignments', requirePerm('assets.read'), (req, res) => {
  const rows = db()
    .prepare(
      `SELECT aa.*, a.asset_code, a.name AS asset_name FROM asset_assignments aa
         JOIN assets a ON a.id = aa.asset_id
        WHERE aa.asset_id = ? ORDER BY aa.assigned_at DESC`,
    )
    .all(req.params.id) as Assignment[];
  res.json({ items: rows });
});

export default router;
