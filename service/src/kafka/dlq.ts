import { pool } from '../db/pool';
import { produce } from './producer';
import { TOPICS } from '../../../shared/src/topics';
import { reportError, trackEvent } from '../monitoring/datadog';
import type { SyncEvent } from '../../../shared/src/types';

export async function sendToDLQ(
  originalTopic: string,
  payload: SyncEvent,
  error: Error,
): Promise<void> {
  await pool.query(
    `INSERT INTO dead_letter_queue (original_topic, event_payload, error_message, next_retry_at)
     VALUES ($1, $2, $3, $4)`,
    [originalTopic, JSON.stringify(payload), error.message, new Date(Date.now() + 30_000)],
  );

  try {
    await produce(TOPICS.DLQ, payload.entityId, { payload, error: error.message });
  } catch (err) {
    console.error('[DLQ] Failed to produce to Kafka DLQ topic:', (err as Error).message);
  }

  trackEvent('dlq.enqueued', { topic: originalTopic });
}

export async function retryDLQ(): Promise<void> {
  const items = await pool.query(
    `SELECT * FROM dead_letter_queue
     WHERE status = 'pending' AND next_retry_at <= now()
     ORDER BY created_at ASC LIMIT 10`,
  );

  for (const item of items.rows) {
    try {
      await pool.query(
        `UPDATE dead_letter_queue SET status = 'retrying', updated_at = now() WHERE id = $1`,
        [item.id],
      );

      await produce(item.original_topic, item.event_payload.entityId, item.event_payload);

      await pool.query('DELETE FROM dead_letter_queue WHERE id = $1', [item.id]);
      trackEvent('dlq.retried', { topic: item.original_topic });
    } catch (err) {
      const newRetry = item.retry_count + 1;
      if (newRetry >= item.max_retries) {
        await pool.query(
          `UPDATE dead_letter_queue SET status = 'exhausted', retry_count = $2, updated_at = now() WHERE id = $1`,
          [item.id, newRetry],
        );
        trackEvent('dlq.exhausted', { topic: item.original_topic });
        reportError(new Error(`DLQ exhausted for event in ${item.original_topic}`), {
          event_id: item.event_payload.eventId,
        });
      } else {
        const delay = 30_000 * Math.pow(2, newRetry);
        await pool.query(
          `UPDATE dead_letter_queue SET status = 'pending', retry_count = $2, next_retry_at = $3, updated_at = now() WHERE id = $1`,
          [item.id, newRetry, new Date(Date.now() + delay)],
        );
      }
    }
  }
}

let dlqTimer: NodeJS.Timeout | null = null;

export function startDLQRetryWorker(intervalMs = 30_000): void {
  dlqTimer = setInterval(async () => {
    try {
      await retryDLQ();
    } catch (err) {
      console.error('[DLQ] Retry worker error:', (err as Error).message);
    }
  }, intervalMs);
  console.log(`[DLQ] Retry worker started (interval: ${intervalMs}ms)`);
}

export function stopDLQRetryWorker(): void {
  if (dlqTimer) {
    clearInterval(dlqTimer);
    dlqTimer = null;
  }
}
