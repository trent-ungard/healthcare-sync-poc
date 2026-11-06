import { produce } from '../kafka/producer';
import { SOURCE_TO_INBOUND } from '../../../shared/src/topics';
import { trackEvent } from '../monitoring/datadog';
import type { FieldUpdate, SourceSystem, EntityType } from '../../../shared/src/types';
import { v4 as uuidv4 } from 'uuid';

interface PollerConfig {
  source: SourceSystem;
  entityType: EntityType;
  intervalMs: number;
  fetchCurrentState: () => Promise<Record<string, unknown>[]>;
}

export class Poller {
  private lastSnapshot: Map<string, Record<string, unknown>> = new Map();
  private timer?: NodeJS.Timeout;
  private config?: PollerConfig;

  start(config: PollerConfig): void {
    this.config = config;
    console.log(`[Poller] Started for ${config.source}/${config.entityType} (interval: ${config.intervalMs}ms)`);

    this.timer = setInterval(async () => {
      try {
        await this.poll();
      } catch (err) {
        console.error(`[Poller] Error polling ${config.source}:`, (err as Error).message);
      }
    }, config.intervalMs);
  }

  private async poll(): Promise<void> {
    if (!this.config) return;

    const records = await this.config.fetchCurrentState();
    for (const record of records) {
      const id = record.id as string;
      const previous = this.lastSnapshot.get(id);

      if (!previous) {
        this.lastSnapshot.set(id, record);
        continue;
      }

      const changes: FieldUpdate[] = [];
      for (const [key, value] of Object.entries(record)) {
        if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
        if (JSON.stringify(value) !== JSON.stringify(previous[key])) {
          changes.push({ fieldName: key, oldValue: previous[key], newValue: value });
        }
      }

      if (changes.length > 0) {
        const topic = SOURCE_TO_INBOUND[this.config.source];
        await produce(topic, id, {
          eventId: uuidv4(),
          source: this.config.source,
          entityType: this.config.entityType,
          entityId: id,
          fields: changes,
          timestamp: new Date().toISOString(),
          actorRole: 'admin',
          correlationId: uuidv4(),
        });
        trackEvent('poller.change_detected', { source: this.config.source });
      }

      this.lastSnapshot.set(id, record);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
