import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Structure {
  user_id: string;
  basic: number;
  hra: number;
  transport: number;
  other_allowances: number;
  pf_deduction: number;
  tax_deduction: number;
  other_deductions: number;
  effective_from: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  full_name: string | null;
  email: string | null;
}

const structureSchema = z.object({
  basic: z.number().min(0),
  hra: z.number().min(0).default(0),
  transport: z.number().min(0).default(0),
  other_allowances: z.number().min(0).default(0),
  pf_deduction: z.number().min(0).default(0),
  tax_deduction: z.number().min(0).default(0),
  other_deductions: z.number().min(0).default(0),
  effective_from: z.string().max(20).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().max(1000).nullable().optional(),
});

function computeTotals(s: {
  basic: number; hra: number; transport: number; other_allowances: number;
  pf_deduction: number; tax_deduction: number; other_deductions: number;
}) {
  const gross = s.basic + s.hra + s.transport + s.other_allowances;
  const totalDeductions = s.pf_deduction + s.tax_deduction + s.other_deductions;
  return { gross, total_deductions: totalDeductions, net: gross - totalDeductions };
}

// Salary structures
router.get('/structures', requirePerm('payroll.read'), (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    const needle = `%${q}%`;
    params.push(needle, needle);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT ss.*, u.full_name, u.email FROM salary_structures ss
         JOIN users u ON u.id = ss.user_id ${clause} ORDER BY u.full_name LIMIT 500`,
    )
    .all(...params) as Structure[];
  res.json({ items: rows });
});

router.get('/structures/:userId', requirePerm('payroll.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT ss.*, u.full_name, u.email FROM salary_structures ss
         JOIN users u ON u.id = ss.user_id WHERE ss.user_id = ?`,
    )
    .get(req.params.userId) as Structure | undefined;
  if (!row) throw new HttpError(404, 'structure_not_found');
  res.json(row);
});

router.put('/structures/:userId', requirePerm('payroll.write'), (req, res, next) => {
  try {
    const body = structureSchema.parse(req.body);
    const exists = db().prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId);
    if (!exists) throw new HttpError(404, 'user_not_found');
    const existing = db().prepare('SELECT user_id FROM salary_structures WHERE user_id = ?').get(req.params.userId);
    if (existing) {
      db()
        .prepare(
          `UPDATE salary_structures SET basic = ?, hra = ?, transport = ?, other_allowances = ?,
             pf_deduction = ?, tax_deduction = ?, other_deductions = ?,
             effective_from = ?, status = ?, notes = ?, updated_at = datetime('now')
             WHERE user_id = ?`,
        )
        .run(
          body.basic, body.hra, body.transport, body.other_allowances,
          body.pf_deduction, body.tax_deduction, body.other_deductions,
          body.effective_from ?? null, body.status, body.notes ?? null,
          req.params.userId,
        );
    } else {
      db()
        .prepare(
          `INSERT INTO salary_structures (user_id, basic, hra, transport, other_allowances,
             pf_deduction, tax_deduction, other_deductions, effective_from, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          req.params.userId, body.basic, body.hra, body.transport, body.other_allowances,
          body.pf_deduction, body.tax_deduction, body.other_deductions,
          body.effective_from ?? null, body.status, body.notes ?? null,
        );
    }
    const row = db()
      .prepare(
        `SELECT ss.*, u.full_name, u.email FROM salary_structures ss
           JOIN users u ON u.id = ss.user_id WHERE ss.user_id = ?`,
      )
      .get(req.params.userId);
    res.json(row);
  } catch (e) {
    next(e);
  }
});

// Payroll runs
router.get('/runs', requirePerm('payroll.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT pr.*,
              (SELECT COUNT(*) FROM payslips ps WHERE ps.run_id = pr.id) AS payslip_count,
              (SELECT COALESCE(SUM(net), 0) FROM payslips ps WHERE ps.run_id = pr.id) AS total_net,
              gb.full_name AS generated_by_name,
              ab.full_name AS approved_by_name
         FROM payroll_runs pr
         LEFT JOIN users gb ON gb.id = pr.generated_by
         LEFT JOIN users ab ON ab.id = pr.approved_by
         ORDER BY pr.year DESC, pr.month DESC`,
    )
    .all();
  res.json({ items: rows });
});

router.get('/runs/:id', requirePerm('payroll.read'), (req, res) => {
  const run = db()
    .prepare(
      `SELECT pr.*, gb.full_name AS generated_by_name, ab.full_name AS approved_by_name
         FROM payroll_runs pr
         LEFT JOIN users gb ON gb.id = pr.generated_by
         LEFT JOIN users ab ON ab.id = pr.approved_by
         WHERE pr.id = ?`,
    )
    .get(req.params.id);
  if (!run) throw new HttpError(404, 'run_not_found');
  const slips = db()
    .prepare(
      `SELECT ps.*, u.full_name AS user_name, u.email AS user_email
         FROM payslips ps JOIN users u ON u.id = ps.user_id
         WHERE ps.run_id = ? ORDER BY u.full_name`,
    )
    .all(req.params.id);
  res.json({ ...run, payslips: slips });
});

const runSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  notes: z.string().max(500).nullable().optional(),
});

router.post('/runs', requirePerm('payroll.write'), (req, res, next) => {
  try {
    const body = runSchema.parse(req.body);
    const dup = db().prepare('SELECT id FROM payroll_runs WHERE year = ? AND month = ?').get(body.year, body.month);
    if (dup) throw new HttpError(409, 'run_already_exists');

    const structures = db()
      .prepare(`SELECT ss.*, u.full_name FROM salary_structures ss
                  JOIN users u ON u.id = ss.user_id WHERE ss.status = ? AND u.is_active = ?`)
      .all('active', 1) as (Structure & { full_name: string })[];

    const runId = id('run');
    const insertRun = db().prepare(
      `INSERT INTO payroll_runs (id, year, month, status, generated_by, notes)
       VALUES (?, ?, ?, 'draft', ?, ?)`,
    );
    const insertSlip = db().prepare(
      `INSERT INTO payslips (id, run_id, user_id, basic, hra, transport, other_allowances,
         pf_deduction, tax_deduction, other_deductions, gross, total_deductions, net)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const tx = db().transaction(() => {
      insertRun.run(runId, body.year, body.month, req.user!.id, body.notes ?? null);
      for (const s of structures) {
        const totals = computeTotals(s);
        insertSlip.run(
          id('pay'), runId, s.user_id,
          s.basic, s.hra, s.transport, s.other_allowances,
          s.pf_deduction, s.tax_deduction, s.other_deductions,
          totals.gross, totals.total_deductions, totals.net,
        );
      }
    });
    tx();
    res.status(201).json({ id: runId, year: body.year, month: body.month });
  } catch (e) {
    next(e);
  }
});

router.patch('/runs/:id/approve', requirePerm('payroll.approve'), (req, res) => {
  const run = db().prepare('SELECT id, status FROM payroll_runs WHERE id = ?').get(req.params.id) as { id: string; status: string } | undefined;
  if (!run) throw new HttpError(404, 'run_not_found');
  if (run.status !== 'draft') throw new HttpError(400, 'already_processed');
  db().prepare(`UPDATE payroll_runs SET status = 'approved', approved_at = datetime('now'), approved_by = ? WHERE id = ?`)
    .run(req.user!.id, req.params.id);
  res.json({ ok: true });
});

router.patch('/runs/:id/pay', requirePerm('payroll.approve'), (req, res) => {
  const run = db().prepare('SELECT id, status FROM payroll_runs WHERE id = ?').get(req.params.id) as { id: string; status: string } | undefined;
  if (!run) throw new HttpError(404, 'run_not_found');
  if (run.status !== 'approved') throw new HttpError(400, 'must_be_approved_first');
  db().prepare(`UPDATE payroll_runs SET status = 'paid', paid_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

router.delete('/runs/:id', requirePerm('payroll.write'), (req, res) => {
  const run = db().prepare('SELECT id, status FROM payroll_runs WHERE id = ?').get(req.params.id) as { id: string; status: string } | undefined;
  if (!run) throw new HttpError(404, 'run_not_found');
  if (run.status === 'paid') throw new HttpError(400, 'cannot_delete_paid_run');
  db().prepare('DELETE FROM payroll_runs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
