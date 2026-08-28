/* CLI entry: `tsx src/jobs/system_events.purge.now.ts` */
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { ensureDirs } from '../config.js';
import { purgeSystemEvents } from './system_events.purge.js';

ensureDirs();

try {
  const r = purgeSystemEvents();
  db()
    .prepare(
      `INSERT INTO system_events (id, level, source, message, details)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      id('evt'),
      'info',
      'system_events.purge',
      `pruned ${r.deleted} rows older than ${r.retention_days} days`,
      JSON.stringify(r),
    );
  console.log('[system_events.purge]', r);
  process.exit(0);
} catch (e) {
  console.error('[system_events.purge] failed:', e);
  process.exit(1);
}
