import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id, publicNo } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';
import { bus, broadcastChannel } from '../lib/sse.js';
import { renderReceiptPdf } from '../services/fees.pdf.js';

const router = Router();
router.use(requireAuth);

// ----------------------------------------------------------------------------
// Structures
// ----------------------------------------------------------------------------
const structureSchema = z.object({
  class_id: z.string().min(1),
  name: z.string().min(1).max(80),
  amount: z.number().nonnegative(),
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one_time']).default('monthly'),
  due_day_of_month: z.number().int().min(1).max(28).default(10),
});

router.get('/structures', requirePerm('fees.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT s.*, c.name AS class_name
         FROM fee_structures s
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE s.status = 'active'
         ORDER BY c.grade_level, c.name, s.name`,
    )
    .all();
  res.json({ items: rows });
});

router.post('/structures', requirePerm('fees.write'), (req, res, next) => {
  try {
    const body = structureSchema.parse(req.body);
    const newId = id('fst');
    db()
      .prepare(
        `INSERT INTO fee_structures
          (id, class_id, name, amount, frequency, due_day_of_month)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId,
        body.class_id,
        body.name,
        body.amount,
        body.frequency,
        body.due_day_of_month,
      );
    const created = db().prepare('SELECT * FROM fee_structures WHERE id = ?').get(newId);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.delete('/structures/:id', requirePerm('fees.write'), (req, res) => {
  db()
    .prepare(`UPDATE fee_structures SET status = 'inactive' WHERE id = ?`)
    .run(req.params.id);
  res.json({ ok: true });
});

// ----------------------------------------------------------------------------
// Invoices
// ----------------------------------------------------------------------------
const generateSchema = z.object({
  class_id: z.string().min(1),
  section_id: z.string().optional().or(z.literal('')),
  structure_id: z.string().min(1),
  period_label: z.string().min(1),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post('/invoices/generate', requirePerm('fees.write'), (req, res, next) => {
  try {
    const body = generateSchema.parse(req.body);
    const structure = db()
      .prepare('SELECT * FROM fee_structures WHERE id = ? AND status = \'active\'')
      .get(body.structure_id) as
      | { id: string; name: string; amount: number; due_day_of_month: number }
      | undefined;
    if (!structure) throw new HttpError(404, 'structure_not_found');

    const studentParams: unknown[] = [body.class_id];
    let studentSql = `SELECT id FROM students WHERE current_class_id = ? AND status = 'active'`;
    if (body.section_id) {
      studentSql += ' AND current_section_id = ?';
      studentParams.push(body.section_id);
    }
    const students = db().prepare(studentSql).all(...studentParams) as { id: string }[];

    if (!students.length) throw new HttpError(400, 'no_students_in_scope');

    const dupCheck = db()
      .prepare(
        'SELECT COUNT(*) AS n FROM fee_invoices WHERE structure_id = ? AND period_label = ? AND student_id = ?',
      )
      .get(body.structure_id, body.period_label, students[0].id) as { n: number };
    if (dupCheck.n > 0) {
      throw new HttpError(409, 'invoices_already_generated_for_period', {
        period: body.period_label,
      });
    }

    const insert = db().prepare(
      `INSERT INTO fee_invoices
        (id, invoice_no, student_id, structure_id, period_label, period_start,
         period_end, amount, total, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const tx = db().transaction(() => {
      for (const s of students) {
        insert.run(
          id('inv'),
          publicNo('INV'),
          s.id,
          body.structure_id,
          body.period_label,
          body.period_start,
          body.period_end,
          structure.amount,
          structure.amount,
          body.due_date,
        );
      }
    });
    tx();
    bus.publish(broadcastChannel(), { type: 'fees.invoices_generated', count: students.length });
    res.status(201).json({ created: students.length });
  } catch (e) {
    next(e);
  }
});

router.get('/invoices', requirePerm('fees.read'), (req, res) => {
  const studentId = (req.query.studentId as string | undefined) ?? '';
  const status = (req.query.status as string | undefined) ?? '';
  const from = (req.query.from as string | undefined) ?? '';
  const to = (req.query.to as string | undefined) ?? '';
  const where: string[] = ['1=1'];
  const params: unknown[] = [];
  if (studentId) {
    where.push('i.student_id = ?');
    params.push(studentId);
  }
  if (status) {
    where.push('i.status = ?');
    params.push(status);
  }
  if (from) {
    where.push('i.period_start >= ?');
    params.push(from);
  }
  if (to) {
    where.push('i.period_end <= ?');
    params.push(to);
  }
  const rows = db()
    .prepare(
      `SELECT i.*, st.first_name, st.last_name, st.admission_no,
              c.name AS class_name, sec.name AS section_name,
              fs.name AS structure_name
         FROM fee_invoices i
         INNER JOIN students st ON st.id = i.student_id
         LEFT JOIN classes c ON c.id = st.current_class_id
         LEFT JOIN sections sec ON sec.id = st.current_section_id
         LEFT JOIN fee_structures fs ON fs.id = i.structure_id
         WHERE ${where.join(' AND ')}
         ORDER BY i.due_date DESC, i.created_at DESC
         LIMIT 500`,
    )
    .all(...params);
  res.json({ items: rows });
});

// ----------------------------------------------------------------------------
// Payments
// ----------------------------------------------------------------------------
const paymentSchema = z.object({
  student_id: z.string().min(1),
  amount: z.number().positive(),
  payment_mode: z.enum(['cash', 'upi', 'bank', 'cheque', 'card']),
  reference: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  allocations: z
    .array(
      z.object({
        invoice_id: z.string().min(1),
        amount: z.number().positive(),
      }),
    )
    .optional(),
});

router.post('/payments', requirePerm('fees.collect'), (req, res, next) => {
  try {
    const body = paymentSchema.parse(req.body);

    const result = db().transaction(() => {
      const receipt = publicNo('RCP');
      const paymentId = id('pmt');
      db()
        .prepare(
          `INSERT INTO fee_payments
            (id, receipt_no, student_id, amount, payment_mode, reference, notes, collected_by, payment_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          paymentId,
          receipt,
          body.student_id,
          body.amount,
          body.payment_mode,
          body.reference ?? null,
          body.notes ?? null,
          req.user?.id ?? null,
          body.payment_date ?? new Date().toISOString().slice(0, 10),
        );

      let remaining = body.amount;
      const allocations: { invoice_id: string; amount: number }[] = [];

      if (body.allocations && body.allocations.length) {
        for (const a of body.allocations) {
          if (remaining <= 0) break;
          const inv = db()
            .prepare('SELECT id, balance FROM fee_invoices WHERE id = ? AND student_id = ?')
            .get(a.invoice_id, body.student_id) as { id: string; balance: number } | undefined;
          if (!inv) continue;
          const apply = Math.min(remaining, inv.balance, a.amount);
          if (apply <= 0) continue;
          db()
            .prepare(
              `INSERT INTO fee_payment_allocations (id, payment_id, invoice_id, amount)
               VALUES (?, ?, ?, ?)`,
            )
            .run(id('pmt'), paymentId, inv.id, apply);
          db()
            .prepare(
              `UPDATE fee_invoices
                 SET paid = paid + ?, balance = balance - ?,
                     status = CASE
                       WHEN balance - ? <= 0 THEN 'paid'
                       WHEN paid + ? > 0 THEN 'partial'
                       ELSE status END
                 WHERE id = ?`,
            )
            .run(apply, apply, apply, apply, inv.id);
          remaining -= apply;
          allocations.push({ invoice_id: inv.id, amount: apply });
        }
      }

      // Auto-allocate to oldest unpaid invoices if not specified
      if (remaining > 0.01) {
        const open = db()
          .prepare(
            `SELECT id, balance FROM fee_invoices
               WHERE student_id = ? AND status IN ('unpaid','partial') AND balance > 0
               ORDER BY due_date ASC`,
          )
          .all(body.student_id) as { id: string; balance: number }[];
        for (const inv of open) {
          if (remaining <= 0) break;
          const apply = Math.min(remaining, inv.balance);
          db()
            .prepare(
              `INSERT INTO fee_payment_allocations (id, payment_id, invoice_id, amount)
               VALUES (?, ?, ?, ?)`,
            )
            .run(id('pmt'), paymentId, inv.id, apply);
          db()
            .prepare(
              `UPDATE fee_invoices
                 SET paid = paid + ?, balance = balance - ?,
                     status = CASE
                       WHEN balance - ? <= 0 THEN 'paid'
                       ELSE 'partial' END
                 WHERE id = ?`,
            )
            .run(apply, apply, apply, inv.id);
          remaining -= apply;
          allocations.push({ invoice_id: inv.id, amount: apply });
        }
      }

      if (remaining > 0.01) {
        // Overpayment — credit as advance (leave on the latest invoice as partial)
        console.warn(`[fees] overpayment of ${remaining} on student ${body.student_id}`);
      }

      return { paymentId, receipt, allocations };
    })();

    bus.publish(broadcastChannel(), {
      type: 'fees.payment_recorded',
      studentId: body.student_id,
      amount: body.amount,
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

router.get('/payments', requirePerm('fees.read'), (req, res) => {
  const studentId = (req.query.studentId as string | undefined) ?? '';
  const params: unknown[] = [];
  const where: string[] = ['1=1'];
  if (studentId) {
    where.push('p.student_id = ?');
    params.push(studentId);
  }
  const rows = db()
    .prepare(
      `SELECT p.*, st.first_name, st.last_name, st.admission_no,
              u.full_name AS collected_by_name
         FROM fee_payments p
         INNER JOIN students st ON st.id = p.student_id
         LEFT JOIN users u ON u.id = p.collected_by
         WHERE ${where.join(' AND ')}
         ORDER BY p.payment_date DESC, p.created_at DESC
         LIMIT 500`,
    )
    .all(...params);
  res.json({ items: rows });
});

router.get('/receipts/:paymentId', requirePerm('fees.collect'), async (req, res, next) => {
  try {
    const format = (req.query.format as string | undefined) ?? 'json';
    const payment = db()
      .prepare(
        `SELECT p.*, st.first_name, st.last_name, st.admission_no, st.guardian_name,
                st.guardian_phone, c.name AS class_name, sec.name AS section_name
           FROM fee_payments p
           INNER JOIN students st ON st.id = p.student_id
           LEFT JOIN classes c ON c.id = st.current_class_id
           LEFT JOIN sections sec ON sec.id = st.current_section_id
           WHERE p.id = ?`,
      )
      .get(req.params.paymentId);
    if (!payment) throw new HttpError(404, 'not_found');

    const allocations = db()
      .prepare(
        `SELECT a.amount, i.invoice_no, i.period_label
           FROM fee_payment_allocations a
           INNER JOIN fee_invoices i ON i.id = a.invoice_id
           WHERE a.payment_id = ?`,
      )
      .all(req.params.paymentId) as { amount: number; invoice_no: string; period_label: string }[];

    const settings = db()
      .prepare("SELECT key, value FROM settings WHERE key LIKE 'school.%' OR key LIKE 'currency.%'")
      .all() as { key: string; value: string }[];
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;

    if (format === 'pdf') {
      const buf = renderReceiptPdf({ payment: payment as Record<string, unknown>, allocations, settings: settingsMap });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="receipt-${(payment as { receipt_no: string }).receipt_no}.pdf"`);
      res.send(buf);
      return;
    }
    res.json({ payment, allocations, settings: settingsMap });
  } catch (e) {
    next(e);
  }
});

router.get('/dashboard', requirePerm('fees.read'), (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const todayRow = db()
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM fee_payments WHERE payment_date = ?")
    .get(today) as { s: number };
  const mtdRow = db()
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM fee_payments WHERE payment_date >= ?")
    .get(monthStart) as { s: number };
  const outstandingRow = db()
    .prepare("SELECT COALESCE(SUM(balance),0) AS s FROM fee_invoices WHERE status IN ('unpaid','partial')")
    .get() as { s: number };
  const monthCollectedByClass = db()
    .prepare(
      `SELECT c.name AS class_name, COALESCE(SUM(p.amount), 0) AS collected
         FROM classes c
         LEFT JOIN students st ON st.current_class_id = c.id
         LEFT JOIN fee_payments p
           ON p.student_id = st.id AND p.payment_date >= ?
         WHERE c.status = 'active'
         GROUP BY c.id
         ORDER BY c.grade_level`,
    )
    .all(monthStart);
  res.json({
    today_collected: todayRow.s,
    mtd_collected: mtdRow.s,
    outstanding: outstandingRow.s,
    by_class: monthCollectedByClass,
  });
});

router.get('/student-balance/:studentId', requirePerm('fees.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT
         COALESCE(SUM(amount), 0) AS total_due,
         COALESCE(SUM(paid), 0) AS total_paid,
         COALESCE(SUM(balance), 0) AS balance
         FROM fee_invoices WHERE student_id = ?`,
    )
    .get(req.params.studentId);
  res.json(row);
});

export default router;