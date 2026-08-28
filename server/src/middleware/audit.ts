import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';

/** Writes an audit row for any state-changing request after the response finishes. */
export function audit(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  res.on('finish', () => {
    try {
      const payloadHash = req.body && Object.keys(req.body).length
        ? createHash('sha256').update(JSON.stringify(req.body)).digest('hex')
        : null;
      db()
        .prepare(
          `INSERT INTO audit_log
            (id, actor_id, route, method, payload_hash, ip, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id('au'),
          req.user?.id ?? null,
          req.originalUrl,
          req.method,
          payloadHash,
          req.ip ?? null,
          res.statusCode,
        );
    } catch (e) {
      console.error('[audit] failed to write audit row:', e);
    }
  });
  next();
}