import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  description: string | null;
  status: string;
}

interface PeriodRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  closed_at: string | null;
}

// Chart of accounts
const accountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  type: z.enum(['asset', 'liability', 'income', 'expense', 'equity']),
  parent_id: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

router.get('/accounts', requirePerm('accounts.read'), (_req, res) => {
  const rows = db()
    .prepare(`SELECT * FROM accounts ORDER BY code`)
    .all() as AccountRow[];
  res.json({ items: rows });
});

router.post('/accounts', requirePerm('accounts.write'), (req, res, next) => {
  try {
    const body = accountSchema.parse(req.body);
    const newId = id('acc');
    try {
      db()
        .prepare(
          `INSERT INTO accounts (id, code, name, type, parent_id, description, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(newId, body.code, body.name, body.type, body.parent_id ?? null,
             body.description ?? null, body.status);
    } catch (e) {
      if (typeof e === 'object' && e && 'code' in e && (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new HttpError(409, 'duplicate_code', 'Account code already exists.');
      }
      throw e;
    }
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/accounts/:id', requirePerm('accounts.write'), (req, res, next) => {
  try {
    const body = accountSchema.partial().parse(req.body);
    const existing = db().prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id) as
      | Record<string, unknown> | undefined;
    if (!existing) throw new HttpError(404, 'account_not_found');
    const merged = {
      code: body.code ?? (existing.code as string),
      name: body.name ?? (existing.name as string),
      type: body.type ?? (existing.type as string),
      parent_id: body.parent_id !== undefined ? body.parent_id : (existing.parent_id as string | null),
      description: body.description !== undefined ? body.description : (existing.description as string | null),
      status: body.status ?? (existing.status as string),
    };
    db()
      .prepare(
        `UPDATE accounts SET code = ?, name = ?, type = ?, parent_id = ?, description = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(merged.code, merged.name, merged.type, merged.parent_id, merged.description, merged.status, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'duplicate_code');
    }
    next(e);
  }
});

router.delete('/accounts/:id', requirePerm('accounts.delete'), (req, res) => {
  const used = db().prepare('SELECT COUNT(*) AS n FROM journal_lines WHERE account_id = ?').get(req.params.id) as { n: number };
  if (used.n > 0) {
    db().prepare(`UPDATE accounts SET status = 'inactive', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    return res.json({ ok: true, deactivated: true });
  }
  db().prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Periods
const periodSchema = z.object({
  name: z.string().min(1).max(80),
  start_date: z.string().min(8),
  end_date: z.string().min(8),
});

router.get('/periods', requirePerm('accounts.read'), (_req, res) => {
  const rows = db()
    .prepare(`SELECT * FROM accounting_periods ORDER BY start_date DESC`)
    .all() as PeriodRow[];
  res.json({ items: rows });
});

router.post('/periods', requirePerm('accounts.write'), (req, res, next) => {
  try {
    const body = periodSchema.parse(req.body);
    if (body.start_date >= body.end_date) throw new HttpError(400, 'invalid_range');
    const newId = id('per');
    db()
      .prepare(`INSERT INTO accounting_periods (id, name, start_date, end_date) VALUES (?, ?, ?, ?)`)
      .run(newId, body.name, body.start_date, body.end_date);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.post('/periods/:id/close', requirePerm('accounts.close'), (req, res, next) => {
  try {
    const period = db().prepare('SELECT * FROM accounting_periods WHERE id = ?').get(req.params.id) as
      | PeriodRow | undefined;
    if (!period) throw new HttpError(404, 'period_not_found');
    if (period.status === 'closed') throw new HttpError(400, 'already_closed');
    db()
      .prepare(`UPDATE accounting_periods SET status = 'closed', closed_at = datetime('now'), closed_by = ? WHERE id = ?`)
      .run(req.user!.id, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/periods/:id/reopen', requirePerm('accounts.close'), (req, res, next) => {
  try {
    const period = db().prepare('SELECT * FROM accounting_periods WHERE id = ?').get(req.params.id) as
      | PeriodRow | undefined;
    if (!period) throw new HttpError(404, 'period_not_found');
    if (period.status !== 'closed') throw new HttpError(400, 'not_closed');
    db()
      .prepare(`UPDATE accounting_periods SET status = 'open', closed_at = NULL, closed_by = NULL WHERE id = ?`)
      .run(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Journal entries
const lineSchema = z.object({
  account_id: z.string().min(1),
  debit: z.number().nonnegative().default(0),
  credit: z.number().nonnegative().default(0),
  narration: z.string().max(500).nullable().optional(),
});

const entrySchema = z.object({
  entry_date: z.string().min(8),
  period_id: z.string().nullable().optional(),
  narration: z.string().min(1).max(500),
  reference: z.string().max(80).nullable().optional(),
  source: z.string().max(40).nullable().optional(),
  source_id: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(2),
}).refine(
  (e) => {
    const totalDebit = e.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = e.lines.reduce((s, l) => s + l.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Debits must equal credits', path: ['lines'] },
).refine(
  (e) => e.lines.every((l) => (l.debit > 0) !== (l.credit > 0) || (l.debit === 0 && l.credit === 0)),
  { message: 'Each line must be either debit or credit, not both', path: ['lines'] },
);

function nextEntryNumber(): string {
  const row = db()
    .prepare(`SELECT COUNT(*) AS n FROM journal_entries`)
    .get() as { n: number };
  const num = (row.n + 1).toString().padStart(6, '0');
  return `JE-${num}`;
}

router.get('/journal', requirePerm('accounts.read'), (req, res) => {
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (startDate) { where.push('e.entry_date >= ?'); params.push(startDate); }
  if (endDate) { where.push('e.entry_date <= ?'); params.push(endDate); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const entries = db()
    .prepare(
      `SELECT e.*, u.full_name AS created_by_name FROM journal_entries e
         LEFT JOIN users u ON u.id = e.created_by
         ${clause}
         ORDER BY e.entry_date DESC, e.created_at DESC LIMIT 200`,
    )
    .all(...params) as Array<{ id: string; [k: string]: unknown }>;
  for (const e of entries) {
    const lines = db()
      .prepare(
        `SELECT l.*, a.code AS account_code, a.name AS account_name
           FROM journal_lines l JOIN accounts a ON a.id = l.account_id
           WHERE l.entry_id = ? ORDER BY l.id`,
      )
      .all(e.id);
    (e as Record<string, unknown>).lines = lines;
  }
  res.json({ items: entries });
});

router.get('/journal/:id', requirePerm('accounts.read'), (req, res, next) => {
  try {
    const entry = db()
      .prepare(
        `SELECT e.*, u.full_name AS created_by_name FROM journal_entries e
           LEFT JOIN users u ON u.id = e.created_by
           WHERE e.id = ?`,
      )
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!entry) throw new HttpError(404, 'entry_not_found');
    const lines = db()
      .prepare(
        `SELECT l.*, a.code AS account_code, a.name AS account_name
           FROM journal_lines l JOIN accounts a ON a.id = l.account_id
           WHERE l.entry_id = ? ORDER BY l.id`,
      )
      .all(req.params.id);
    res.json({ ...entry, lines });
  } catch (e) { next(e); }
});

router.post('/journal', requirePerm('accounts.write'), (req, res, next) => {
  try {
    const body = entrySchema.parse(req.body);
    const newId = id('je');
    const entryNumber = nextEntryNumber();
    const lines = body.lines.filter((l) => l.debit > 0 || l.credit > 0);
    if (lines.length < 2) throw new HttpError(400, 'min_lines', 'Need at least two non-zero lines');

    const tx = db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO journal_entries (id, entry_number, entry_date, period_id, narration, reference, source, source_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(newId, entryNumber, body.entry_date, body.period_id ?? null, body.narration,
             body.reference ?? null, body.source ?? null, body.source_id ?? null, req.user!.id);
      const ins = db().prepare(
        `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, narration) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const l of lines) {
        ins.run(id('jel'), newId, l.account_id, l.debit, l.credit, l.narration ?? null);
      }
    });
    tx();
    res.status(201).json({ id: newId, entry_number: entryNumber });
  } catch (e) { next(e); }
});

router.post('/journal/:id/reverse', requirePerm('accounts.write'), (req, res, next) => {
  try {
    const entry = db().prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id) as
      | Record<string, unknown> | undefined;
    if (!entry) throw new HttpError(404, 'entry_not_found');
    if (entry.status === 'reversed') throw new HttpError(400, 'already_reversed');
    const lines = db().prepare('SELECT * FROM journal_lines WHERE entry_id = ?').all(req.params.id) as
      Array<{ account_id: string; debit: number; credit: number }>;
    const newId = id('je');
    const entryNumber = nextEntryNumber();
    const tx = db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO journal_entries (id, entry_number, entry_date, period_id, narration, reference, source, source_id, created_by, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted')`,
        )
        .run(newId, entryNumber, new Date().toISOString().slice(0, 10), entry.period_id ?? null,
             `Reversal of ${entry.entry_number}: ${entry.narration}`, entry.reference ?? null,
             'reversal', req.params.id, req.user!.id);
      const ins = db().prepare(
        `INSERT INTO journal_lines (id, entry_id, account_id, debit, credit) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const l of lines) {
        ins.run(id('jel'), newId, l.account_id, l.credit, l.debit);
      }
      db().prepare(`UPDATE journal_entries SET status = 'reversed', reversed_by = ? WHERE id = ?`)
        .run(newId, req.params.id);
    });
    tx();
    res.status(201).json({ id: newId, entry_number: entryNumber });
  } catch (e) { next(e); }
});

// Reports
router.get('/reports/trial-balance', requirePerm('accounts.read'), (req, res) => {
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';
  const params: unknown[] = [];
  const dateFilter: string[] = [];
  if (startDate) { dateFilter.push('je.entry_date >= ?'); params.push(startDate); }
  if (endDate) { dateFilter.push('je.entry_date <= ?'); params.push(endDate); }
  const clause = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT a.id, a.code, a.name, a.type,
              COALESCE(SUM(jl.debit), 0) AS total_debit,
              COALESCE(SUM(jl.credit), 0) AS total_credit,
              COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS balance
         FROM accounts a
         LEFT JOIN journal_lines jl ON jl.account_id = a.id
         LEFT JOIN journal_entries je ON je.id = jl.entry_id AND je.status IN ('posted')
         ${clause ? clause.replace(/^AND/, 'WHERE') : ''}
         GROUP BY a.id
         ORDER BY a.code`,
    )
    .all(...params);
  const totals = (rows as Array<{ total_debit: number; total_credit: number }>).reduce(
    (acc, r) => ({
      debit: acc.debit + r.total_debit,
      credit: acc.credit + r.total_credit,
    }),
    { debit: 0, credit: 0 },
  );
  res.json({ items: rows, totals });
});

router.get('/reports/pl', requirePerm('accounts.read'), (req, res) => {
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';
  const params: unknown[] = [];
  const dateFilter: string[] = [];
  if (startDate) { dateFilter.push('je.entry_date >= ?'); params.push(startDate); }
  if (endDate) { dateFilter.push('je.entry_date <= ?'); params.push(endDate); }
  const clause = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';
  const rows = db()
    .prepare(
      `SELECT a.type, COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) AS amount
         FROM accounts a
         LEFT JOIN journal_lines jl ON jl.account_id = a.id
         LEFT JOIN journal_entries je ON je.id = jl.entry_id AND je.status = 'posted'
         ${clause ? clause.replace(/^AND/, 'WHERE') : ''}
         GROUP BY a.type`,
    )
    .all(...params) as Array<{ type: string; amount: number }>;
  const get = (t: string) => rows.find((r) => r.type === t)?.amount ?? 0;
  const income = get('income');
  const expense = get('expense');
  res.json({
    income,
    expense,
    net: income - expense,
    breakdown: rows,
  });
});

router.get('/reports/balance-sheet', requirePerm('accounts.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT a.type, COALESCE(SUM(jl.debit), 0) AS debit, COALESCE(SUM(jl.credit), 0) AS credit
         FROM accounts a
         LEFT JOIN journal_lines jl ON jl.account_id = a.id
         LEFT JOIN journal_entries je ON je.id = jl.entry_id AND je.status = 'posted'
         GROUP BY a.type`,
    )
    .all() as Array<{ type: string; debit: number; credit: number }>;
  const get = (t: string) => rows.find((r) => r.type === t);
  const asset = get('asset');
  const liability = get('liability');
  const equity = get('equity');
  res.json({
    asset_total: (asset?.debit ?? 0) - (asset?.credit ?? 0),
    liability_total: (liability?.credit ?? 0) - (liability?.debit ?? 0),
    equity_total: (equity?.credit ?? 0) - (equity?.debit ?? 0),
    breakdown: rows,
  });
});

export default router;