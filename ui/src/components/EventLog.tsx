import React from 'react';

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
  accessControl: { role: string };
}

interface Props {
  events: EventEnvelope[];
}

const outcomeColors: Record<string, string> = {
  applied: '#16a34a',
  conflict_rejected: '#ca8a04',
  validation_failed: '#dc2626',
};

const outcomeLabels: Record<string, string> = {
  applied: 'Applied',
  conflict_rejected: 'Conflict',
  validation_failed: 'Validation Failed',
};

export function EventLog({ events }: Props) {
  if (events.length === 0) {
    return (
      <div style={{ color: '#9ca3af', fontStyle: 'italic', padding: 16 }}>
        No events yet. Make a change in one of the systems above.
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px' }}>Time</th>
            <th style={{ padding: '8px 12px' }}>Entity</th>
            <th style={{ padding: '8px 12px' }}>Field</th>
            <th style={{ padding: '8px 12px' }}>Outcome</th>
            <th style={{ padding: '8px 12px' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {events.flatMap((env) =>
            env.event.fieldResults.map((fr, i) => (
              <tr key={`${env.event.eventId}-${i}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                  {new Date(env.event.timestamp).toLocaleTimeString()}
                </td>
                <td style={{ padding: '6px 12px' }}>
                  {env.event.entityType}
                </td>
                <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>
                  {fr.fieldName}
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <span
                    style={{
                      color: outcomeColors[fr.outcome] || '#6b7280',
                      fontWeight: 600,
                    }}
                  >
                    {outcomeLabels[fr.outcome] || fr.outcome}
                  </span>
                </td>
                <td style={{ padding: '6px 12px', fontSize: 12, color: '#6b7280', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fr.reason || (fr.appliedValue !== undefined ? `= ${JSON.stringify(fr.appliedValue)}` : '')}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
