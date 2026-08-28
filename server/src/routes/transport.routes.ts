import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface RouteRow {
  id: string;
  route_code: string;
  name: string;
  vehicle_id: string | null;
  driver_id: string | null;
  morning_pickup_time: string | null;
  evening_drop_time: string | null;
  distance_km: number | null;
  status: string;
  vehicle_number: string | null;
  driver_name: string | null;
  stop_count: number;
  student_count: number;
}

interface StopRow {
  id: string;
  route_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  stop_order: number;
  pickup_time: string | null;
  drop_time: string | null;
  fare: number;
}

const routeSchema = z.object({
  route_code: z.string().min(1).max(40),
  name: z.string().min(1).max(160),
  vehicle_id: z.string().nullable().optional(),
  driver_id: z.string().nullable().optional(),
  morning_pickup_time: z.string().max(10).nullable().optional(),
  evening_drop_time: z.string().max(10).nullable().optional(),
  distance_km: z.number().min(0).max(10000).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const stopSchema = z.object({
  name: z.string().min(1).max(160),
  address: z.string().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  stop_order: z.number().int().min(0).max(500).default(0),
  pickup_time: z.string().max(10).nullable().optional(),
  drop_time: z.string().max(10).nullable().optional(),
  fare: z.number().min(0).max(100000).default(0),
});

const allocSchema = z.object({
  stop_id: z.string().min(1),
  student_id: z.string().min(1),
  effective_from: z.string().min(8).optional(),
  effective_to: z.string().min(8).nullable().optional(),
});

router.get('/', requirePerm('transport.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT r.*, v.vehicle_number, d.full_name AS driver_name,
              (SELECT COUNT(*) FROM transport_stops WHERE route_id = r.id) AS stop_count,
              (SELECT COUNT(*) FROM transport_allocations WHERE route_id = r.id AND status = 'active') AS student_count
         FROM transport_routes r
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
         LEFT JOIN drivers d ON d.id = r.driver_id
         ORDER BY r.route_code`,
    )
    .all() as RouteRow[];
  res.json({ items: rows });
});

router.get('/:id', requirePerm('transport.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT r.*, v.vehicle_number, d.full_name AS driver_name
         FROM transport_routes r
         LEFT JOIN vehicles v ON v.id = r.vehicle_id
         LEFT JOIN drivers d ON d.id = r.driver_id
         WHERE r.id = ?`,
    )
    .get(req.params.id) as RouteRow | undefined;
  if (!row) throw new HttpError(404, 'route_not_found');
  const stops = db()
    .prepare(`SELECT * FROM transport_stops WHERE route_id = ? ORDER BY stop_order, name`)
    .all(req.params.id) as StopRow[];
  const allocations = db()
    .prepare(
      `SELECT a.*, s.first_name || ' ' || s.last_name AS student_name, s.admission_no, st.name AS stop_name
         FROM transport_allocations a
         JOIN students s ON s.id = a.student_id
         JOIN transport_stops st ON st.id = a.stop_id
         WHERE a.route_id = ? AND a.status = 'active'
         ORDER BY st.stop_order, s.last_name`,
    )
    .all(req.params.id);
  res.json({ ...row, stops, allocations });
});

router.post('/', requirePerm('transport.write'), (req, res, next) => {
  try {
    const body = routeSchema.parse(req.body);
    const newId = id('rte');
    db()
      .prepare(
        `INSERT INTO transport_routes (id, route_code, name, vehicle_id, driver_id, morning_pickup_time, evening_drop_time, distance_km, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId, body.route_code, body.name, body.vehicle_id ?? null, body.driver_id ?? null,
        body.morning_pickup_time ?? null, body.evening_drop_time ?? null,
        body.distance_km ?? null, body.status,
      );
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('transport.write'), (req, res, next) => {
  try {
    const body = routeSchema.partial().parse(req.body);
    const exists = db().prepare(`SELECT id FROM transport_routes WHERE id = ?`).get(req.params.id);
    if (!exists) throw new HttpError(404, 'route_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const cols = ['route_code','name','vehicle_id','driver_id','morning_pickup_time','evening_drop_time','distance_km','status'] as const;
    for (const c of cols) {
      if ((body as Record<string, unknown>)[c] !== undefined) {
        fields.push(`${c} = ?`);
        params.push((body as Record<string, unknown>)[c]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE transport_routes SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requirePerm('transport.write'), (req, res) => {
  const r = db().prepare(`DELETE FROM transport_routes WHERE id = ?`).run(req.params.id);
  if (r.changes === 0) throw new HttpError(404, 'route_not_found');
  res.json({ ok: true });
});

// Stops
router.post('/:id/stops', requirePerm('transport.write'), (req, res, next) => {
  try {
    const body = stopSchema.parse(req.body);
    const route = db().prepare(`SELECT id FROM transport_routes WHERE id = ?`).get(req.params.id);
    if (!route) throw new HttpError(404, 'route_not_found');
    const newId = id('stp');
    db()
      .prepare(
        `INSERT INTO transport_stops (id, route_id, name, address, latitude, longitude, stop_order, pickup_time, drop_time, fare)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId, req.params.id, body.name, body.address ?? null,
        body.latitude ?? null, body.longitude ?? null,
        body.stop_order, body.pickup_time ?? null, body.drop_time ?? null, body.fare,
      );
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/:id/stops/:stopId', requirePerm('transport.write'), (req, res, next) => {
  try {
    const body = stopSchema.partial().parse(req.body);
    const exists = db().prepare(`SELECT id FROM transport_stops WHERE id = ? AND route_id = ?`).get(req.params.stopId, req.params.id);
    if (!exists) throw new HttpError(404, 'stop_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const cols = ['name','address','latitude','longitude','stop_order','pickup_time','drop_time','fare'] as const;
    for (const c of cols) {
      if ((body as Record<string, unknown>)[c] !== undefined) {
        fields.push(`${c} = ?`);
        params.push((body as Record<string, unknown>)[c]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    db().prepare(`UPDATE transport_stops SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.stopId);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id/stops/:stopId', requirePerm('transport.write'), (req, res) => {
  const r = db().prepare(`DELETE FROM transport_stops WHERE id = ? AND route_id = ?`).run(req.params.stopId, req.params.id);
  if (r.changes === 0) throw new HttpError(404, 'stop_not_found');
  res.json({ ok: true });
});

// Allocations
router.post('/:id/allocations', requirePerm('transport.write'), (req, res, next) => {
  try {
    const body = allocSchema.parse(req.body);
    const route = db().prepare(`SELECT id FROM transport_routes WHERE id = ?`).get(req.params.id);
    if (!route) throw new HttpError(404, 'route_not_found');
    const stop = db().prepare(`SELECT id FROM transport_stops WHERE id = ? AND route_id = ?`).get(body.stop_id, req.params.id);
    if (!stop) throw new HttpError(404, 'stop_not_in_route');
    const newId = id('alc');
    db()
      .prepare(
        `INSERT INTO transport_allocations (id, route_id, stop_id, student_id, effective_from, effective_to)
         VALUES (?, ?, ?, ?, COALESCE(?, date('now')), ?)`,
      )
      .run(newId, req.params.id, body.stop_id, body.student_id, body.effective_from ?? null, body.effective_to ?? null);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.delete('/:id/allocations/:allocId', requirePerm('transport.write'), (req, res) => {
  const r = db().prepare(`UPDATE transport_allocations SET status='cancelled' WHERE id = ? AND route_id = ?`).run(req.params.allocId, req.params.id);
  if (r.changes === 0) throw new HttpError(404, 'allocation_not_found');
  res.json({ ok: true });
});

export default router;
