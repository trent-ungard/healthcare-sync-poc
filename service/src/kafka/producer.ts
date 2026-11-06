import { Kafka, Producer } from 'kafkajs';
import { config } from '../config';

const kafka = new Kafka({
  clientId: 'healthcare-sync-service',
  brokers: config.kafkaBrokers,
  retry: { retries: 5, initialRetryTime: 1000 },
});

let producer: Producer;

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    console.log('[Kafka] Producer connected');
  }
  return producer;
}

export async function produce(topic: string, key: string, value: object): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    messages: [{ key, value: JSON.stringify(value) }],
  });
}

export { kafka };
