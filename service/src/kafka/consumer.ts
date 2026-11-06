import { Consumer } from 'kafkajs';
import { kafka } from './producer';
import { INBOUND_TOPICS } from '../../../shared/src/topics';
import type { SyncEvent } from '../../../shared/src/types';

let consumer: Consumer;

type EventHandler = (event: SyncEvent, topic: string) => Promise<void>;

let handler: EventHandler = async (event, topic) => {
  console.log(`[Kafka] Received event on ${topic}:`, event.eventId);
};

export function setEventHandler(fn: EventHandler) {
  handler = fn;
}

export async function startConsumer(): Promise<void> {
  consumer = kafka.consumer({ groupId: 'healthcare-sync-group' });

  let retries = 0;
  const maxRetries = 15;
  while (retries < maxRetries) {
    try {
      await consumer.connect();
      console.log('[Kafka] Consumer connected');
      break;
    } catch (err) {
      retries++;
      console.log(`[Kafka] Consumer connection attempt ${retries}/${maxRetries} failed, retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (retries >= maxRetries) {
    console.error('[Kafka] Consumer failed to connect after max retries');
    return;
  }

  for (const topic of INBOUND_TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }
  console.log('[Kafka] Subscribed to inbound topics');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      try {
        const event: SyncEvent = JSON.parse(message.value.toString());
        await handler(event, topic);
      } catch (err) {
        console.error(`[Kafka] Error processing message from ${topic}:`, (err as Error).message);
      }
    },
  });
}

export async function stopConsumer(): Promise<void> {
  if (consumer) await consumer.disconnect();
}
