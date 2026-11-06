import React from 'react';

interface FieldResult {
  fieldName: string;
  outcome: string;
  reason?: string;
}

interface Props {
  fieldResults: FieldResult[];
  onDismiss: () => void;
}

export function ConflictBanner({ fieldResults, onDismiss }: Props) {
  const errors = fieldResults.filter((f) => f.outcome !== 'applied');
  if (errors.length === 0) return null;

  return (
    <div
      style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 6,
        padding: '12px 16px',
        marginBottom: 16,
        position: 'relative',
      }}
    >
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute',
          top: 8,
          right: 12,
          background: 'none',
          border: 'none',
          fontSize: 18,
          cursor: 'pointer',
          color: '#991b1b',
        }}
      >
        x
      </button>
      <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>
        Sync Issues Detected
      </div>
      {errors.map((e, i) => (
        <div key={i} style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 4 }}>
          <strong>{e.fieldName}</strong>: {e.outcome === 'conflict_rejected' ? 'Conflict' : 'Validation Failed'}
          {e.reason && <span> - {e.reason}</span>}
        </div>
      ))}
    </div>
  );
}
