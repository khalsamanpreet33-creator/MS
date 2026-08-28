import cron, { type ScheduledTask } from 'node-cron';
import { db } from '../db/client.js';
import { id } from '../lib/ids.js';
import { runBackup } from './backup.job.js';
import { flushOutbox } from './outbox.flush.js';
import { purgeSystemEvents } from './system_events.purge.js';
import { bus, broadcastChannel } from '../lib/sse.js';

interface AutomationRow {
  id: string;
  name: string;
  cron_expr: string;
  handler: string;
  is_enabled: number;
}

const handlers: Record<string, () => Promise<void> | void> = {
  'backup.run': async () => {
    const r = await runBackup();
    bus.publish(broadcastChannel(), { type: 'backup.completed', result: r });
  },
  'attendance.remind': async () => {
    // Insert an in-app reminder into outbox (will be queued; no provider yet so it ends failed).
    db()
      .prepare(
        `INSERT INTO communication_outbox (id, channel, recipient, subject, body)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        id('obx'),
        'inapp',
        'teachers',
        'Attendance reminder',
        'Please mark attendance for today before 09:00.',
      );
    bus.publish(broadcastChannel(), { type: 'attendance.reminder_sent' });
  },
  'outbox.flush': async () => {
    await flushOutbox();
  },
  'system_events.purge': () => {
    const r = purgeSystemEvents();
    console.log(`[system_events.purge] pruned ${r.deleted} rows older than ${r.retention_days}d`);
  },
};

const active = new Map<string, ScheduledTask>();

export function startScheduler(): void {
  const rows = db()
    .prepare('SELECT id, name, cron_expr, handler, is_enabled FROM automations')
    .all() as AutomationRow[];

  for (const row of rows) {
    if (!row.is_enabled) continue;
    if (!cron.validate(row.cron_expr)) {
      console.warn(`[scheduler] invalid cron for "${row.name}": ${row.cron_expr}`);
      continue;
    }
    if (!handlers[row.handler]) {
      console.warn(`[scheduler] no handler registered for "${row.handler}"`);
      continue;
    }
    const task = cron.schedule(row.cron_expr, async () => {
      const runId = id('ar');
      const startedAt = new Date().toISOString();
      db()
        .prepare(
          `INSERT INTO automation_runs (id, automation_id, status, started_at)
           VALUES (?, ?, 'running', ?)`,
        )
        .run(runId, row.id, startedAt);
      try {
        await handlers[row.handler]();
        db()
          .prepare(
            `UPDATE automation_runs SET finished_at = datetime('now'), status = 'success'
             WHERE id = ?`,
          )
          .run(runId);
        db()
          .prepare(`UPDATE automations SET last_run_at = datetime('now') WHERE id = ?`)
          .run(row.id);
      } catch (e) {
        db()
          .prepare(
            `UPDATE automation_runs SET finished_at = datetime('now'), status = 'failed', error = ?
             WHERE id = ?`,
          )
          .run((e as Error).message, runId);
      }
    });
    active.set(row.id, task);
    console.log(`[scheduler] registered "${row.name}" @ ${row.cron_expr}`);
  }
}

export function stopScheduler(): void {
  for (const [id, task] of active) {
    task.stop();
    active.delete(id);
  }
}