import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { HttpError } from '../lib/zodError.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface CertificateTemplate {
  id: string;
  name: string;
  certificate_type: string;
  template_html: string;
  status: string;
}

interface GeneratedCert {
  id: string;
  template_id: string;
  template_name: string;
  certificate_type: string;
  certificate_number: string;
  issued_to_name: string;
  issued_to_id: string | null;
  issued_date: string;
  details: string | null;
  created_at: string;
}

const tplSchema = z.object({
  name: z.string().min(1).max(120),
  certificate_type: z.enum(['bonafide', 'transfer', 'character', 'achievement', 'completion', 'custom']),
  template_html: z.string().min(1).max(20000),
  status: z.enum(['active', 'inactive']).default('active'),
});

const issueSchema = z.object({
  template_id: z.string().min(1),
  issued_to_name: z.string().min(1).max(160),
  issued_to_id: z.string().nullable().optional(),
  issued_date: z.string().min(8),
  details: z.string().max(2000).nullable().optional(),
});

function nextCertNumber(type: string): string {
  const prefix = type.toUpperCase().slice(0, 3);
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS n FROM generated_certificates gc
         JOIN certificate_templates ct ON ct.id = gc.template_id
        WHERE ct.certificate_type = ?`,
    )
    .get(type) as { n: number };
  return `${prefix}-${(row.n + 1).toString().padStart(5, '0')}`;
}

router.get('/templates', requirePerm('certificates.read'), (_req, res) => {
  const rows = db()
    .prepare('SELECT * FROM certificate_templates ORDER BY certificate_type, name')
    .all() as CertificateTemplate[];
  res.json({ items: rows });
});

router.post('/templates', requirePerm('certificates.write'), (req, res, next) => {
  try {
    const body = tplSchema.parse(req.body);
    const newId = id('ctt');
    db()
      .prepare(
        `INSERT INTO certificate_templates (id, name, certificate_type, template_html, status)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(newId, body.name, body.certificate_type, body.template_html, body.status);
    res.status(201).json({ id: newId });
  } catch (e) { next(e); }
});

router.patch('/templates/:id', requirePerm('certificates.write'), (req, res, next) => {
  try {
    const body = tplSchema.partial().parse(req.body);
    const exists = db().prepare('SELECT id FROM certificate_templates WHERE id = ?').get(req.params.id);
    if (!exists) throw new HttpError(404, 'template_not_found');
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = { name: 'name', certificate_type: 'certificate_type', template_html: 'template_html', status: 'status' };
    for (const [k, col] of Object.entries(map)) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        fields.push(`${col} = ?`);
        params.push((body as Record<string, unknown>)[k]);
      }
    }
    if (fields.length === 0) throw new HttpError(400, 'no_updates');
    fields.push(`updated_at = datetime('now')`);
    db().prepare(`UPDATE certificate_templates SET ${fields.join(', ')} WHERE id = ?`).run(...params, req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/templates/:id', requirePerm('certificates.write'), (req, res) => {
  const exists = db().prepare('SELECT id FROM certificate_templates WHERE id = ?').get(req.params.id);
  if (!exists) throw new HttpError(404, 'template_not_found');
  db().prepare('DELETE FROM certificate_templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/issued', requirePerm('certificates.read'), (_req, res) => {
  const rows = db()
    .prepare(
      `SELECT gc.id, gc.template_id, ct.name AS template_name,
              ct.certificate_type, gc.certificate_number,
              gc.issued_to_name, gc.issued_to_id, gc.issued_date, gc.details, gc.created_at
         FROM generated_certificates gc
         JOIN certificate_templates ct ON ct.id = gc.template_id
         ORDER BY gc.created_at DESC LIMIT 200`,
    )
    .all() as GeneratedCert[];
  res.json({ items: rows });
});

router.post('/issued', requirePerm('certificates.write'), (req, res, next) => {
  try {
    const body = issueSchema.parse(req.body);
    const tpl = db()
      .prepare('SELECT certificate_type FROM certificate_templates WHERE id = ?')
      .get(body.template_id) as { certificate_type: string } | undefined;
    if (!tpl) throw new HttpError(404, 'template_not_found');
    const newId = id('gct');
    const certNumber = nextCertNumber(tpl.certificate_type);
    db()
      .prepare(
        `INSERT INTO generated_certificates (id, template_id, certificate_number, issued_to_name, issued_to_id, issued_date, details, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(newId, body.template_id, certNumber, body.issued_to_name, body.issued_to_id ?? null,
           body.issued_date, body.details ?? null, req.user!.id);
    res.status(201).json({ id: newId, certificate_number: certNumber });
  } catch (e) { next(e); }
});

export default router;