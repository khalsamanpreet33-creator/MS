import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Item {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  unit: string;
  min_stock: number;
  current_stock: number;
  unit_cost: number;
  location: string | null;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
  status: string;
}

interface Movement {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  reference: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  notes: string | null;
  created_at: string;
  creator_name: string | null;
}

interface PO {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor_name: string | null;
  status: string;
  total_amount: number;
  notes: string | null;
  expected_date: string | null;
  created_at: string;
}

const itemSchema = z.object({
  sku: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category_id: z.string().nullable().optional(),
  unit: z.enum(['pcs', 'box', 'kg', 'litre', 'meter', 'set', 'pack']).default('pcs'),
  min_stock: z.number().min(0).default(0),
  unit_cost: z.number().min(0).default(0),
  location: z.string().max(60).nullable().optional(),
  status: z.enum(['active', 'archived']).default('active'),
});

const vendorSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  gstin: z.string().max(20).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const movementSchema = z.object({
  item_id: z.string().min(1),
  movement_type: z.enum(['in', 'out', 'adjust']),
  quantity: z.number().min(0.01),
  unit_cost: z.number().min(0).optional(),
  reference: z.string().max(120).nullable().optional(),
  vendor_id: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

// Categories
router.get('/categories', requirePerm('inventory.read'), (_req, res) => {
  const rows = db().prepare(`SELECT * FROM inventory_categories ORDER BY name`).all();
  res.json({ items: rows });
});

router.post('/categories', requirePerm('inventory.write'), (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(80) });
    const body = schema.parse(req.body);
    const newId = id('ivc');
    db().prepare(`INSERT INTO inventory_categories (id, name) VALUES (?, ?)`).run(newId, body.name);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

// Vendors
router.get('/vendors', requirePerm('inventory.read'), (_req, res) => {
  const rows = db().prepare(`SELECT * FROM vendors ORDER BY name`).all() as Vendor[];
  res.json({ items: rows });
});

router.post('/vendors', requirePerm('inventory.write'), (req, res, next) => {
  try {
    const body = vendorSchema.parse(req.body);
    const newId = id('vnd');
    db()
      .prepare(
        `INSERT INTO vendors (id, name, phone, email, address, gstin, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.name, body.phone ?? null, body.email ?? null,
           body.address ?? null, body.gstin ?? null, body.notes ?? null, body.status);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/vendors/:id', requirePerm('inventory.write'), (req, res, next) => {
  try {
    const body = vendorSchema.partial().parse(req.body);
    const exists = db().prepare(`SELECT id FROM vendors WHERE id = ?`).get(req.params.id);
    if (!exists) throw new HttpError(404, 'vendor_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const cols = ['name','phone','email','address','gstin','notes','status'] as const;
    for (const c of cols) {
      if ((body as Record<string, unknown>)[c] !== undefined) {
        fields.push(`${c} = ?`);
        params.push((body as Record<string, unknown>)[c]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Items
router.get('/items', requirePerm('inventory.read'), (req, res) => {
  const q = (req.query.q as string | undefined) ?? '';
  const search = `%${q}%`;
  const rows = db()
    .prepare(
      `SELECT i.*, c.name AS category_name FROM inventory_items i
         LEFT JOIN inventory_categories c ON c.id = i.category_id
        WHERE i.name LIKE ? OR i.sku LIKE ?
        ORDER BY i.name LIMIT 200`,
    )
    .all(search, search) as Item[];
  res.json({ items: rows });
});

router.post('/items', requirePerm('inventory.write'), (req, res, next) => {
  try {
    const body = itemSchema.parse(req.body);
    const newId = id('itm');
    db()
      .prepare(
        `INSERT INTO inventory_items (id, sku, name, description, category_id, unit, min_stock, current_stock, unit_cost, location, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(newId, body.sku, body.name, body.description ?? null, body.category_id ?? null,
           body.unit, body.min_stock, body.unit_cost, body.location ?? null, body.status);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/items/:id', requirePerm('inventory.write'), (req, res, next) => {
  try {
    const body = itemSchema.partial().parse(req.body);
    const exists = db().prepare(`SELECT id FROM inventory_items WHERE id = ?`).get(req.params.id);
    if (!exists) throw new HttpError(404, 'item_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const cols = ['sku','name','description','category_id','unit','min_stock','unit_cost','location','status'] as const;
    for (const c of cols) {
      if ((body as Record<string, unknown>)[c] !== undefined) {
        fields.push(`${c} = ?`);
        params.push((body as Record<string, unknown>)[c]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE inventory_items SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/items/:id', requirePerm('inventory.write'), (req, res) => {
  const r = db().prepare(`DELETE FROM inventory_items WHERE id = ?`).run(req.params.id);
  if (r.changes === 0) throw new HttpError(404, 'item_not_found');
  res.json({ ok: true });
});

// Stock movements
router.get('/movements', requirePerm('inventory.read'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const rows = db()
    .prepare(
      `SELECT m.*, i.name AS item_name, i.sku, v.name AS vendor_name, u.full_name AS creator_name
         FROM stock_movements m
         JOIN inventory_items i ON i.id = m.item_id
         LEFT JOIN vendors v ON v.id = m.vendor_id
         LEFT JOIN users u ON u.id = m.created_by
         ORDER BY m.created_at DESC LIMIT ?`,
    )
    .all(limit) as Movement[];
  res.json({ items: rows });
});

router.post('/movements', requirePerm('inventory.write'), (req, res, next) => {
  try {
    const body = movementSchema.parse(req.body);
    const item = db().prepare(`SELECT current_stock FROM inventory_items WHERE id = ?`).get(body.item_id) as { current_stock: number } | undefined;
    if (!item) throw new HttpError(404, 'item_not_found');
    let newStock = item.current_stock;
    if (body.movement_type === 'in') newStock += body.quantity;
    else if (body.movement_type === 'out') {
      if (item.current_stock < body.quantity) throw new HttpError(400, 'insufficient_stock');
      newStock -= body.quantity;
    } else {
      newStock = body.quantity; // adjust sets absolute
    }
    const newId = id('stk');
    const tx = db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO stock_movements (id, item_id, movement_type, quantity, unit_cost, reference, vendor_id, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(newId, body.item_id, body.movement_type, body.quantity, body.unit_cost ?? null,
             body.reference ?? null, body.vendor_id ?? null, body.notes ?? null, req.user!.id);
      db().prepare(`UPDATE inventory_items SET current_stock = ? WHERE id = ?`).run(newStock, body.item_id);
    });
    tx();
    res.status(201).json({ id: newId, current_stock: newStock });
  } catch (e) { next(e); }
});

// Purchase orders
router.get('/purchase-orders', requirePerm('inventory.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT p.*, v.name AS vendor_name FROM purchase_orders p
         LEFT JOIN vendors v ON v.id = p.vendor_id
         ORDER BY p.created_at DESC LIMIT 100`,
    )
    .all() as PO[];
  res.json({ items: rows });
});

router.get('/purchase-orders/:id', requirePerm('inventory.read'), (req, res) => {
  const po = db()
    .prepare(
      `SELECT p.*, v.name AS vendor_name FROM purchase_orders p
         LEFT JOIN vendors v ON v.id = p.vendor_id WHERE p.id = ?`,
    )
    .get(req.params.id) as PO | undefined;
  if (!po) throw new HttpError(404, 'po_not_found');
  const items = db()
    .prepare(
      `SELECT pi.*, i.name AS item_name, i.sku FROM purchase_order_items pi
         JOIN inventory_items i ON i.id = pi.item_id WHERE pi.po_id = ?`,
    )
    .all(req.params.id);
  res.json({ ...po, items });
});

router.post('/purchase-orders', requirePerm('inventory.write'), (req, res, next) => {
  try {
    const schema = z.object({
      vendor_id: z.string().min(1),
      notes: z.string().max(2000).nullable().optional(),
      expected_date: z.string().min(8).nullable().optional(),
      items: z.array(z.object({
        item_id: z.string().min(1),
        quantity: z.number().min(0.01),
        unit_cost: z.number().min(0),
      })).min(1),
    });
    const body = schema.parse(req.body);
    const vendor = db().prepare(`SELECT id FROM vendors WHERE id = ?`).get(body.vendor_id);
    if (!vendor) throw new HttpError(404, 'vendor_not_found');
    const newId = id('po');
    const poNumber = `PO-${Date.now().toString().slice(-7)}`;
    const total = body.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
    const tx = db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO purchase_orders (id, po_number, vendor_id, status, total_amount, notes, expected_date, created_by)
           VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
        )
        .run(newId, poNumber, body.vendor_id, total, body.notes ?? null, body.expected_date ?? null, req.user!.id);
      const ins = db().prepare(
        `INSERT INTO purchase_order_items (id, po_id, item_id, quantity, unit_cost) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const i of body.items) {
        ins.run(id('poi'), newId, i.item_id, i.quantity, i.unit_cost);
      }
    });
    tx();
    res.status(201).json({ id: newId, po_number: poNumber, total_amount: total });
  } catch (e) { next(e); }
});

router.post('/purchase-orders/:id/receive', requirePerm('inventory.write'), (req, res, next) => {
  try {
    const schema = z.object({
      receipts: z.array(z.object({
        item_id: z.string().min(1),
        quantity: z.number().min(0.01),
      })).min(1),
    }).optional();
    const body = schema.parse(req.body);
    const po = db().prepare(`SELECT id, status FROM purchase_orders WHERE id = ?`).get(req.params.id);
    if (!po) throw new HttpError(404, 'po_not_found');
    if (!body) throw new HttpError(400, 'receipts_required');
    const tx = db().transaction(() => {
      for (const r of body.receipts) {
        db().prepare(`UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE po_id = ? AND item_id = ?`)
          .run(r.quantity, req.params.id, r.item_id);
        // Add to stock
        db().prepare(
          `INSERT INTO stock_movements (id, item_id, movement_type, quantity, reference, vendor_id, created_by)
           VALUES (?, ?, 'in', ?, ?, (SELECT vendor_id FROM purchase_orders WHERE id = ?), ?)`,
        ).run(id('stk'), r.item_id, r.quantity, `PO ${req.params.id}`, req.params.id, req.user!.id);
        db().prepare(`UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?`).run(r.quantity, r.item_id);
      }
      // Compute status
      const total = db().prepare(`SELECT SUM(quantity) AS q, SUM(received_qty) AS r FROM purchase_order_items WHERE po_id = ?`).get(req.params.id) as { q: number; r: number };
      let status: string = 'placed';
      if (total.r === 0) status = 'placed';
      else if (total.r < total.q) status = 'partial';
      else status = 'received';
      db().prepare(`UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
    });
    tx();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
