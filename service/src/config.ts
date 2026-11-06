import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/healthcare_sync',
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  ddAgentHost: process.env.DD_AGENT_HOST || '',
  ddStatsdPort: parseInt(process.env.DD_DOGSTATSD_PORT || '8125', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  enablePolling: process.env.ENABLE_POLLING === 'true',
};
