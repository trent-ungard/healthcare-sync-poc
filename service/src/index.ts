import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { pool } from './db/pool';
import { apiRouter } from './routes/api';
import { startConsumer, setEventHandler } from './kafka/consumer';
import { getProducer } from './kafka/producer';
import { handleSyncEvent, emitDownstream, emitToSocketIO } from './ingestion/event-handler';
import { startDLQRetryWorker } from './kafka/dlq';
import { loadRules } from './validation/engine';
import { reportError } from './monitoring/datadog';
import { sendToDLQ } from './kafka/dlq';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: { origin: '*' },
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', db: 'disconnected', error: (err as Error).message });
  }
});

app.use('/api', apiRouter);

io.on('connection', (socket) => {
  const role = (socket.handshake.query.role as string) || 'readonly';
  const source = (socket.handshake.query.source as string) || 'unknown';
  console.log(`[Socket.IO] Client connected: role=${role}, source=${source}, id=${socket.id}`);
  socket.join(`role:${role}`);
  socket.join(`source:${source}`);
  socket.data.role = role;
  socket.data.source = source;

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

async function start() {
  server.listen(config.port, () => {
    console.log(`[Server] Running on port ${config.port}`);
    console.log(`[Server] Environment: ${config.nodeEnv}`);
  });

  await loadRules();

  setEventHandler(async (event, topic) => {
    try {
      const result = await handleSyncEvent(event);
      await emitDownstream(event, result);
      await emitToSocketIO(event, result);
      console.log(`[Pipeline] Processed event ${event.eventId}: ${result.fieldResults.map((f) => `${f.fieldName}=${f.outcome}`).join(', ')}`);
    } catch (err) {
      reportError(err as Error, { topic, event_id: event.eventId });
      await sendToDLQ(topic, event, err as Error);
    }
  });

  try {
    await getProducer();
    await startConsumer();
    startDLQRetryWorker();
  } catch (err) {
    console.error('[Server] Kafka connection failed (service will work without real-time processing):', (err as Error).message);
  }
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

export { app, server };
