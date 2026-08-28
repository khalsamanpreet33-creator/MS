import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface Book {
  id: string;
  accession_no: string;
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  category_id: string | null;
  category_name: string | null;
  total_copies: number;
  available_copies: number;
  shelf_location: string | null;
  status: string;
}

interface Issue {
  id: string;
  book_id: string;
  book_title: string;
  accession_no: string;
  borrower_type: string;
  borrower_id: string;
  borrower_name: string;
  issued_at: string;
  due_at: string;
  returned_at: string | null;
  status: string;
  fine_amount: number;
}

// Books
const bookSchema = z.object({
  accession_no: z.string().min(1).max(40),
  isbn: z.string().max(40).nullable().optional(),
  title: z.string().min(1).max(300),
  author: z.string().min(1).max(200),
  publisher: z.string().max(200).nullable().optional(),
  category_id: z.string().nullable().optional(),
  total_copies: z.number().int().min(1).max(1000).default(1),
  shelf_location: z.string().max(60).nullable().optional(),
  status: z.enum(['available', 'archived', 'lost']).default('available'),
});

router.get('/books', requirePerm('library.read'), (req, res) => {
  const q = (req.query.q as string | undefined) ?? '';
  const search = `%${q}%`;
  const rows = db()
    .prepare(
      `SELECT b.*, c.name AS category_name FROM books b
         LEFT JOIN book_categories c ON c.id = b.category_id
        WHERE b.title LIKE ? OR b.author LIKE ? OR b.accession_no LIKE ?
        ORDER BY b.title LIMIT 200`,
    )
    .all(search, search, search) as Book[];
  res.json({ items: rows });
});

router.get('/books/:id', requirePerm('library.read'), (req, res) => {
  const row = db()
    .prepare(
      `SELECT b.*, c.name AS category_name FROM books b
         LEFT JOIN book_categories c ON c.id = b.category_id
         WHERE b.id = ?`,
    )
    .get(req.params.id) as Book | undefined;
  if (!row) throw new HttpError(404, 'book_not_found');
  res.json(row);
});

router.post('/books', requirePerm('library.write'), (req, res, next) => {
  try {
    const body = bookSchema.parse(req.body);
    const newId = id('bok');
    db()
      .prepare(
        `INSERT INTO books (id, accession_no, isbn, title, author, publisher, category_id, total_copies, available_copies, shelf_location, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId, body.accession_no, body.isbn ?? null, body.title, body.author,
        body.publisher ?? null, body.category_id ?? null,
        body.total_copies, body.total_copies,
        body.shelf_location ?? null, body.status,
      );
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/books/:id', requirePerm('library.write'), (req, res, next) => {
  try {
    const body = bookSchema.partial().parse(req.body);
    const exists = db().prepare(`SELECT id FROM books WHERE id = ?`).get(req.params.id);
    if (!exists) throw new HttpError(404, 'book_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const cols = ['accession_no','isbn','title','author','publisher','category_id','shelf_location','status'] as const;
    for (const c of cols) {
      if ((body as Record<string, unknown>)[c] !== undefined) {
        fields.push(`${c} = ?`);
        params.push((body as Record<string, unknown>)[c]);
      }
    }
    if (body.total_copies !== undefined) {
      fields.push(`total_copies = ?`);
      params.push(body.total_copies);
      // Recompute available to keep non-negative
      const cur = db().prepare(`SELECT available_copies FROM books WHERE id = ?`).get(req.params.id) as { available_copies: number };
      const issued = cur.available_copies === 0 ? 0 : (body.total_copies - cur.available_copies);
      fields.push(`available_copies = ?`);
      params.push(Math.max(0, body.total_copies - issued));
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/books/:id', requirePerm('library.write'), (req, res) => {
  const r = db().prepare(`DELETE FROM books WHERE id = ?`).run(req.params.id);
  if (r.changes === 0) throw new HttpError(404, 'book_not_found');
  res.json({ ok: true });
});

// Categories
router.get('/categories', requirePerm('library.read'), (_req, res) => {
  const rows = db().prepare(`SELECT * FROM book_categories ORDER BY name`).all();
  res.json({ items: rows });
});

router.post('/categories', requirePerm('library.write'), (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(80), code: z.string().max(20).nullable().optional() });
    const body = schema.parse(req.body);
    const newId = id('bct');
    db().prepare(`INSERT INTO book_categories (id, name, code) VALUES (?, ?, ?)`).run(newId, body.name, body.code ?? null);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

// Issues
const issueSchema = z.object({
  book_id: z.string().min(1),
  borrower_type: z.enum(['student', 'staff']),
  borrower_id: z.string().min(1),
  borrower_name: z.string().min(1).max(160),
  due_at: z.string().min(8),
  notes: z.string().max(500).nullable().optional(),
});

router.get('/issues', requirePerm('library.read'), (req, res) => {
  const status = (req.query.status as string | undefined) ?? null;
  const rows = db()
    .prepare(
      `SELECT i.*, b.title AS book_title, b.accession_no,
              COALESCE((SELECT SUM(amount) FROM book_fines WHERE issue_id = i.id AND paid = 0), 0) AS fine_amount
         FROM book_issues i
         JOIN books b ON b.id = i.book_id
        WHERE (? IS NULL OR i.status = ?)
        ORDER BY i.issued_at DESC
        LIMIT 200`,
    )
    .all(status, status) as Issue[];
  res.json({ items: rows });
});

router.post('/issues', requirePerm('library.write'), (req, res, next) => {
  try {
    const body = issueSchema.parse(req.body);
    const book = db().prepare(`SELECT available_copies, title FROM books WHERE id = ?`).get(body.book_id) as { available_copies: number; title: string } | undefined;
    if (!book) throw new HttpError(404, 'book_not_found');
    if (book.available_copies < 1) throw new HttpError(400, 'no_copies_available');
    const newId = id('iss');
    const tx = db().transaction(() => {
      db().prepare(
        `INSERT INTO book_issues (id, book_id, borrower_type, borrower_id, borrower_name, issued_by, due_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(newId, body.book_id, body.borrower_type, body.borrower_id, body.borrower_name,
            req.user!.id, body.due_at, body.notes ?? null);
      db().prepare(`UPDATE books SET available_copies = available_copies - 1 WHERE id = ?`).run(body.book_id);
    });
    tx();
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.post('/issues/:id/return', requirePerm('library.write'), (req, res, next) => {
  try {
    const schema = z.object({ fine_amount: z.number().min(0).optional(), fine_reason: z.string().max(80).optional() }).optional();
    const body = schema.parse(req.body);
    const issue = db().prepare(`SELECT book_id, status, due_at FROM book_issues WHERE id = ?`).get(req.params.id) as { book_id: string; status: string; due_at: string } | undefined;
    if (!issue) throw new HttpError(404, 'issue_not_found');
    if (issue.status !== 'issued' && issue.status !== 'overdue') throw new HttpError(400, 'already_returned');
    const tx = db().transaction(() => {
      db().prepare(
        `UPDATE book_issues SET status = 'returned', returned_at = datetime('now'), returned_to = ? WHERE id = ?`,
      ).run(req.user!.id, req.params.id);
      db().prepare(`UPDATE books SET available_copies = available_copies + 1 WHERE id = ?`).run(issue.book_id);
      if (body?.fine_amount && body.fine_amount > 0) {
        db().prepare(
          `INSERT INTO book_fines (id, issue_id, amount, reason) VALUES (?, ?, ?, ?)`,
        ).run(id('fin'), req.params.id, body.fine_amount, body.fine_reason ?? 'overdue');
      }
    });
    tx();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
