import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import { db } from '../db/client.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyJwt, loadUser } from '../lib/auth.js';
import { bus, writeSseHeaders, sendSse } from '../lib/sse.js';
import { id } from '../lib/ids.js';

const router = Router();

router.get('/', (_req, res) => {
  let dbSize = 0;
  try {
    dbSize = fs.statSync(config.dbPath).size;
  } catch {
    dbSize = 0;
  }
  let freeDisk = 0;
  try {
    const s = fs.statfsSync(config.schoolDataDir);
    freeDisk = s.bavail * s.bsize;
  } catch {
    freeDisk = 0;
  }

  const lastBackup = db()
    .prepare(
      `SELECT created_at, message FROM system_events
         WHERE source = 'backup' ORDER BY created_at DESC LIMIT 1`,
    )
    .get() as { created_at: string; message: string } | undefined;

  const automations = db()
    .prepare(
      `SELECT id, name, cron_expr, handler, is_enabled, last_run_at, next_run_at
         FROM automations ORDER BY name`,
    )
    .all() as { last_run_at: string | null; next_run_at: string | null; is_enabled: number }[];

  const pendingOutbox = (db()
    .prepare("SELECT COUNT(*) AS n FROM communication_outbox WHERE status = 'queued'")
    .get() as { n: number }).n;

  const failedOutbox = (db()
    .prepare("SELECT COUNT(*) AS n FROM communication_outbox WHERE status = 'failed'")
    .get() as { n: number }).n;

  res.json({
    status: 'ok',
    server_time: new Date().toISOString(),
    db: { path: config.dbPath, size_bytes: dbSize },
    storage: {
      school_data_dir: config.schoolDataDir,
      backups_dir: config.backupsDir,
      free_bytes: freeDisk,
    },
    backup: lastBackup
      ? { last_at: lastBackup.created_at, message: lastBackup.message }
      : { last_at: null, message: null },
    automations,
    outbox: { queued: pendingOutbox, failed: failedOutbox },
  });
});

router.get('/events', (req: Request, res: Response, next) => {
  // EventSource in browsers cannot set Authorization headers; allow ?access_token=... fallback.
  const header = req.header('authorization') ?? '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token && typeof req.query.access_token === 'string') {
    token = req.query.access_token;
  }
  if (!token) {
    res.status(401).end('unauthorized');
    return;
  }
  try {
    const payload = verifyJwt(token);
    const user = loadUser(payload.sub);
    if (!user || !user.is_active) throw new Error('inactive');
    req.user = user;
  } catch {
    res.status(401).end('unauthorized');
    return;
  }

  writeSseHeaders(res);
  const userChannel = `user:${req.user.id}`;
  const allChannel = 'broadcast';

  const unsubUser = bus.subscribe(userChannel, (payload) => sendSse(res, 'message', payload));
  const unsubAll = bus.subscribe(allChannel, (payload) => sendSse(res, 'broadcast', payload));

  sendSse(res, 'hello', { userId: req.user.id, serverTime: new Date().toISOString() });
  const hb = setInterval(() => sendSse(res, 'heartbeat', { t: Date.now() }), 30_000);

  req.on('close', () => {
    clearInterval(hb);
    unsubUser();
    unsubAll();
  });
});

router.post('/events/test', requireAuth, (req, res) => {
  bus.publish('broadcast', {
    type: 'event.test',
    id: id('evt'),
    message: 'Test event from server',
    at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

export default router;