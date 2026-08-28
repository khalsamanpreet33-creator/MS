import { config } from '../config.js';
import { db } from '../db/client.js';

export interface PurgeResult {
  deleted: number;
  retention_days: number;
  cutoff: string;
}

/**
 * Deletes system_events rows older than the configured retention window.
 * Runs as the `system_events.purge` scheduler handler and via the
 * `purge:now` CLI. Keeps the table bounded so the dashboard's recent-events
 * feed stays cheap and the health endpoint doesn't have to scan years of
 * history.
 */
export function purgeSystemEvents(): PurgeResult {
  const retention = config.systemEventsRetentionDays;
  const cutoff = new Date(Date.now() - retention * 24 * 60 * 60 * 1000).toISOString();

  const result = db()
    .prepare(`DELETE FROM system_events WHERE created_at < ?`)
    .run(cutoff);

  return {
    deleted: result.changes,
    retention_days: retention,
    cutoff,
  };
}
