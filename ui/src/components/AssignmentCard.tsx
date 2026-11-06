import React from 'react';

interface Props {
  title: string;
  records: Record<string, unknown>[];
  displayFields: { key: string; label: string }[];
}

export function AssignmentCard({ title, records, displayFields }: Props) {
  if (records.length === 0) {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#f9fafb' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: 14 }}>{title}</h4>
        <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>No assignments</div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#f9fafb' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: 14 }}>
        {title}
        <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
          (read-only — managed by source system)
        </span>
      </h4>
      {records.map((record, idx) => (
        <div
          key={idx}
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 12,
            marginBottom: idx < records.length - 1 ? 8 : 0,
          }}
        >
          {displayFields.map(({ key, label }) => {
            const value = record[key];
            if (value === undefined) return null;
            const display = Array.isArray(value) ? value.join(', ') : String(value ?? '');
            return (
              <div key={key} style={{ display: 'flex', marginBottom: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#6b7280', minWidth: 140 }}>{label}:</span>
                <span style={{ color: '#1f2937' }}>{display || '—'}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
