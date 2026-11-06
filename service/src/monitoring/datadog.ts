import StatsD from 'hot-shots';
import { config } from '../config';

const useMock = !config.ddAgentHost;

export const dogstatsd = new StatsD({
  host: config.ddAgentHost || 'localhost',
  port: config.ddStatsdPort,
  prefix: 'healthcare_sync.',
  mock: useMock,
});

if (useMock) {
  console.log('[Datadog] Running in mock mode — metrics logged to console');
}

export function reportError(error: Error, context: Record<string, string> = {}): void {
  const tags = Object.entries(context).map(([k, v]) => `${k}:${v}`);
  dogstatsd.increment('error', 1, tags);
  console.error('[DATADOG] Error:', error.message, context);
}

export function trackEvent(name: string, tags: Record<string, string> = {}): void {
  const tagArray = Object.entries(tags).map(([k, v]) => `${k}:${v}`);
  dogstatsd.increment(name, 1, tagArray);
  if (useMock) {
    console.log(`[DATADOG] ${name}`, tags);
  }
}

export function trackDuration(name: string, durationMs: number, tags: Record<string, string> = {}): void {
  const tagArray = Object.entries(tags).map(([k, v]) => `${k}:${v}`);
  dogstatsd.histogram(name, durationMs, tagArray);
  if (useMock) {
    console.log(`[DATADOG] ${name}: ${durationMs}ms`, tags);
  }
}
