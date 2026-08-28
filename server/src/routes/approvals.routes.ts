import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface QueueItem {
  id: string;
  type: 'leave' | 'concession' | 'refund';
  ref: string;
  requester_name: string | null;
  requester_label: string;
  summary: string;
  amount: number | null;
  requested_at: string;
  status: string;
  raw: Record<string, unknown>;
}

// Unified approval queue: leaves + fee concessions + refunds with one filter
router.get('/queue', requirePerm('approvals.read'), (req, res, next) => {
  try {
    const schema = z.object({
      type: z.enum(['all', 'leave', 'concession', 'refund']).default('all'),
      status: z.enum(['all', 'pending', 'approved', 'rejected']).default('pending'),
    });
    const { type, status } = schema.parse(req.query);
    const items: QueueItem[] = [];

    if (type === 'all' || type === 'leave') {
      const statusFilter = status === 'all' ? '' : `AND la.status = ?`;
      const params = status === 'all' ? [] : [status];
      const rows = db()
        .prepare(
          `SELECT la.*, u.full_name AS requester_name, lt.name AS leave_type_name
             FROM leave_applications la
             LEFT JOIN users u ON u.id = la.user_id
             LEFT JOIN leave_types lt ON lt.id = la.leave_type_id
            WHERE 1=1 ${statusFilter}
            ORDER BY la.created_at DESC LIMIT 100`,
        )
        .all(...params) as Array<any>;
      for (const r of rows) {
        items.push({
          id: r.id,
          type: 'leave',
          ref: `Leave ${r.leave_type_name ?? ''}`,
          requester_name: r.requester_name,
          requester_label: r.requester_name ?? 'Unknown',
          summary: `${r.from_date} → ${r.to_date} (${r.days} day(s)) — ${r.reason ?? 'no reason'}`,
          amount: null,
          requested_at: r.created_at,
          status: r.status,
          raw: r,
        });
      }
    }

    if (type === 'all' || type === 'concession') {
      const statusFilter = status === 'all' ? '' : `AND fc.status = ?`;
      const params = status === 'all' ? [] : [status];
      const rows = db()
        .prepare(
          `SELECT fc.*, s.first_name || ' ' || s.last_name AS student_name, s.admission_no,
                  u.full_name AS requester_name
             FROM fee_concessions fc
             JOIN students s ON s.id = fc.student_id
             LEFT JOIN users u ON u.id = fc.requested_by
            WHERE 1=1 ${statusFilter}
            ORDER BY fc.created_at DESC LIMIT 100`,
        )
        .all(...params) as Array<any>;
      for (const r of rows) {
        items.push({
          id: r.id,
          type: 'concession',
          ref: `Concession ${r.concession_type === 'percentage' ? r.concession_value + '%' : '₹' + r.concession_value}`,
          requester_name: r.requester_name,
          requester_label: `${r.student_name} (${r.admission_no})`,
          summary: `${r.reason} (valid ${r.valid_from}${r.valid_to ? ' → ' + r.valid_to : ''})`,
          amount: r.concession_type === 'fixed' ? r.concession_value : null,
          requested_at: r.created_at,
          status: r.status,
          raw: r,
        });
      }
    }

    if (type === 'all' || type === 'refund') {
      const statusFilter = status === 'all' ? '' : `AND rf.status = ?`;
      const params = status === 'all' ? [] : [status];
      const rows = db()
        .prepare(
          `SELECT rf.*, s.first_name || ' ' || s.last_name AS student_name, s.admission_no,
                  u.full_name AS requester_name
             FROM refunds rf
             JOIN students s ON s.id = rf.student_id
             LEFT JOIN users u ON u.id = rf.requested_by
            WHERE 1=1 ${statusFilter}
            ORDER BY rf.created_at DESC LIMIT 100`,
        )
        .all(...params) as Array<any>;
      for (const r of rows) {
        items.push({
          id: r.id,
          type: 'refund',
          ref: `Refund ${r.receipt_no}`,
          requester_name: r.requester_name,
          requester_label: `${r.student_name} (${r.admission_no})`,
          summary: r.reason,
          amount: r.amount,
          requested_at: r.created_at,
          status: r.status,
          raw: r,
        });
      }
    }

    items.sort((a, b) => b.requested_at.localeCompare(a.requested_at));
    res.json({ type, status, items });
  } catch (e) { next(e); }
});

// Approve / reject
router.post('/leave/:id/decision', requirePerm('approvals.write'), (req, res, next) => {
  try {
    const schema = z.object({
      decision: z.enum(['approved', 'rejected']),
      notes: z.string().max(2000).nullable().optional(),
    });
    const body = schema.parse(req.body);
    const exists = db().prepare(`SELECT id, status FROM leave_applications WHERE id = ?`).get(req.params.id) as { id: string; status: string } | undefined;
    if (!exists) throw new HttpError(404, 'leave_not_found');
    if (exists.status !== 'pending') throw new HttpError(400, 'already_decided');
    db()
      .prepare(`UPDATE leave_applications SET status = ?, approver_id = ?, decision_at = datetime('now'), decision_notes = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(body.decision, req.user!.id, body.notes ?? null, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

const concessionCreate = z.object({
  student_id: z.string().min(1),
  reason: z.string().min(1).max(500),
  concession_type: z.enum(['percentage', 'fixed']),
  concession_value: z.number().min(0),
  applies_to_fee_head_id: z.string().nullable().optional(),
  valid_from: z.string().min(8),
  valid_to: z.string().min(8).nullable().optional(),
});

router.post('/concessions', requirePerm('approvals.write'), (req, res, next) => {
  try {
    const body = concessionCreate.parse(req.body);
    const newId = id('fcs');
    db()
      .prepare(
        `INSERT INTO fee_concessions (id, student_id, reason, concession_type, concession_value, applies_to_fee_head_id, valid_from, valid_to, requested_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.student_id, body.reason, body.concession_type, body.concession_value,
           body.applies_to_fee_head_id ?? null, body.valid_from, body.valid_to ?? null, req.user!.id);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.post('/concessions/:id/decision', requirePerm('approvals.write'), (req, res, next) => {
  try {
    const schema = z.object({
      decision: z.enum(['approved', 'rejected', 'revoked']),
      notes: z.string().max(2000).nullable().optional(),
    });
    const body = schema.parse(req.body);
    const exists = db().prepare(`SELECT id, status FROM fee_concessions WHERE id = ?`).get(req.params.id) as { id: string; status: string } | undefined;
    if (!exists) throw new HttpError(404, 'concession_not_found');
    if (exists.status !== 'pending' && body.decision !== 'revoked') throw new HttpError(400, 'already_decided');
    db()
      .prepare(`UPDATE fee_concessions SET status = ?, approver_id = ?, decision_at = datetime('now'), decision_notes = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(body.decision, req.user!.id, body.notes ?? null, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

const refundCreate = z.object({
  student_id: z.string().min(1),
  payment_id: z.string().nullable().optional(),
  amount: z.number().min(0),
  reason: z.string().min(1).max(500),
});

router.post('/refunds', requirePerm('approvals.write'), (req, res, next) => {
  try {
    const body = refundCreate.parse(req.body);
    const newId = id('rfd');
    const receiptNo = `RF-${Date.now().toString().slice(-7)}`;
    db()
      .prepare(
        `INSERT INTO refunds (id, receipt_no, student_id, payment_id, amount, reason, requested_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, receiptNo, body.student_id, body.payment_id ?? null, body.amount, body.reason, req.user!.id);
    res.status(201).json({ id: newId, receipt_no: receiptNo });
  } catch (e) { next(e); }
});

router.post('/refunds/:id/decision', requirePerm('approvals.write'), (req, res, next) => {
  try {
    const schema = z.object({
      decision: z.enum(['approved', 'rejected', 'processed']),
      notes: z.string().max(2000).nullable().optional(),
    });
    const body = schema.parse(req.body);
    const exists = db().prepare(`SELECT id, status FROM refunds WHERE id = ?`).get(req.params.id) as { id: string; status: string } | undefined;
    if (!exists) throw new HttpError(404, 'refund_not_found');
    if (exists.status === 'processed') throw new HttpError(400, 'already_processed');
    const newStatus = body.decision === 'processed' ? 'processed' : body.decision;
    db()
      .prepare(
        `UPDATE refunds SET status = ?, approver_id = ?, decision_at = datetime('now'), decision_notes = ?,
                            processed_at = CASE WHEN ? = 'processed' THEN datetime('now') ELSE processed_at END,
                            updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(newStatus, req.user!.id, body.notes ?? null, newStatus, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
