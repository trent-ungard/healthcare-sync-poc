import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface EventEnvelope {
  event: {
    eventId: string;
    entityType: string;
    entityId: string;
    fieldResults: {
      fieldName: string;
      outcome: string;
      reason?: string;
      appliedValue?: unknown;
    }[];
    timestamp: string;
  };
  accessControl: {
    role: string;
    visibleFields: string[];
    redactedFields: string[];
  };
  entityData?: Record<string, unknown>;
}

interface UseSocketReturn {
  connected: boolean;
  lastUpdate: EventEnvelope | null;
  lastError: EventEnvelope | null;
  eventLog: EventEnvelope[];
}

export function useSocket(role: string, source: string): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<EventEnvelope | null>(null);
  const [lastError, setLastError] = useState<EventEnvelope | null>(null);
  const [eventLog, setEventLog] = useState<EventEnvelope[]>([]);

  const addToLog = useCallback((envelope: EventEnvelope) => {
    setEventLog((prev) => [envelope, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const socket = io(apiUrl, {
      query: { role, source },
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('sync:update', (envelope: EventEnvelope) => {
      setLastUpdate(envelope);
      addToLog(envelope);
    });

    socket.on('sync:error', (envelope: EventEnvelope) => {
      setLastError(envelope);
      setTimeout(() => setLastError(null), 10_000);
    });

    return () => {
      socket.disconnect();
    };
  }, [role, source, addToLog]);

  return { connected, lastUpdate, lastError, eventLog };
}
