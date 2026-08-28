import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { config, ensureDirs } from './config.js';
import { db } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.service.js';
import { startOutboxFlusher, stopOutboxFlusher } from './jobs/outbox.flush.js';
import apiRouter from './routes/index.js';
import { id } from './lib/ids.js';
import { HttpError } from './lib/zodError.js';

ensureDirs();

// 1. Migrate
runMigrations();

// 2. Seed admin user if none exists
const userCount = (db().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
if (userCount === 0) {
  console.log('[bootstrap] no users found — running seed...');
  const { seed } = await import('./db/seed.js');
  seed();
}

// 3. Express
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(morgan('tiny'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Static school-data uploads (read-only)
app.use('/uploads', express.static(config.schoolDataDir));

// API
app.use('/api', apiRouter);

// 4. Catch-all error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // HttpError carries its own status + payload; everything else is 500.
  if (err instanceof HttpError) {
    if (err.status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
    res.status(err.status).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  try {
    db()
      .prepare(
        `INSERT INTO system_events (id, level, source, message, details)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id('evt'), 'error', 'http', (err as Error).message ?? String(err), req.originalUrl);
  } catch {
    /* ignore */
  }
  res.status(500).json({ error: 'internal_error', message: (err as Error).message });
});

// 5. Listen
const server = app.listen(config.port, config.host, () => {
  console.log(`[server] listening on http://${config.host}:${config.port}`);
  console.log(`[server] db: ${config.dbPath}`);
  console.log(`[server] school-data: ${config.schoolDataDir}`);
  console.log(`[server] backups: ${config.backupsDir}`);
  startScheduler();
  startOutboxFlusher();
});

// Graceful shutdown
function shutdown() {
  console.log('[server] shutting down...');
  stopScheduler();
  stopOutboxFlusher();
  server.close(() => {
    db().close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);