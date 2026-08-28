import { db } from '../db/client.js';
import { config } from '../config.js';
import { id } from '../lib/ids.js';

interface OutboxRow {
  id: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'inapp';
  recipient: string;
  subject: string | null;
  body: string;
  attempts: number;
}

async function sendOne(row: OutboxRow): Promise<{ ok: boolean; error?: string; provider?: string }> {
  // Phase 1: no providers wired. Mark failed with a clear reason.
  return {
    ok: false,
    error: `no provider configured for channel ${row.channel}`,
  };
}

export async function flushOutbox(): Promise<{ processed: number; sent: number; failed: number }> {
  const due = db()
    .prepare(
      `SELECT id, channel, recipient, subject, body, attempts
         FROM communication_outbox
         WHERE status = 'queued' AND scheduled_at <= datetime('now')
         ORDER BY scheduled_at ASC
         LIMIT 50`,
    )
    .all() as OutboxRow[];

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    db()
      .prepare(
        `UPDATE communication_outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ?`,
      )
      .run(row.id);

    const result = await sendOne(row);
    if (result.ok) {
      db()
        .prepare(
          `UPDATE communication_outbox
             SET status = 'sent', sent_at = datetime('now'), provider = ?, last_error = NULL
             WHERE id = ?`,
        )
        .run(result.provider ?? null, row.id);
      sent++;
    } else {
      const isPermanent = (row.attempts + 1) >= 5;
      db()
        .prepare(
          `UPDATE communication_outbox
             SET status = ?, last_error = ?, provider = COALESCE(?, provider)
             WHERE id = ?`,
        )
        .run(isPermanent ? 'failed' : 'queued', result.error ?? 'unknown', result.provider ?? null, row.id);
      failed++;
    }
  }

  return { processed: due.length, sent, failed };
}

let timer: NodeJS.Timeout | null = null;

export function startOutboxFlusher(): void {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await flushOutbox();
      if (r.processed) {
        console.log(`[outbox] processed=${r.processed} sent=${r.sent} failed=${r.failed}`);
      }
    } catch (e) {
      console.error('[outbox] flush failed:', e);
      db()
        .prepare(
          `INSERT INTO system_events (id, level, source, message) VALUES (?, ?, ?, ?)`,
        )
        .run(id('evt'), 'error', 'outbox', (e as Error).message);
    }
  };
  timer = setInterval(tick, config.outboxFlushIntervalMs);
  console.log(`[outbox] flusher started (every ${config.outboxFlushIntervalMs}ms)`);
}

export function stopOutboxFlusher(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}