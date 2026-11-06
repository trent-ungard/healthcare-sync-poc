import React, { useState } from 'react';
import { submitEvent } from '../api';

interface Props {
  clinicianId: string;
  clinicianName: string;
  currentStatus: string;
  role: string;
  sourceId: string;
  onStatusChange: () => void;
}

export function CallOffButton({ clinicianId, clinicianName, currentStatus, role, sourceId, onStatusChange }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const isCalledOff = currentStatus === 'called_off';

  const handleClick = async () => {
    if (!isCalledOff && !confirmed) {
      setConfirmed(true);
      return;
    }

    setSubmitting(true);
    try {
      const newStatus = isCalledOff ? 'active' : 'called_off';
      await submitEvent({
        source: sourceId,
        entityType: 'clinician',
        entityId: clinicianId,
        fields: [{ fieldName: 'status', oldValue: currentStatus, newValue: newStatus }],
        actorRole: role,
      });
      setConfirmed(false);
      onStatusChange();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => setConfirmed(false);

  if (isCalledOff) {
    return (
      <div style={{
        background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 8,
        padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>!</span>
          <span style={{ fontWeight: 700, color: '#991b1b', fontSize: 16 }}>
            {clinicianName} has called off
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12 }}>
          This clinician is currently unavailable. Affected patient visits need coverage.
        </div>
        <button
          onClick={handleClick}
          disabled={submitting}
          style={{
            padding: '8px 20px', background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {submitting ? 'Restoring...' : 'Restore to Active'}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: confirmed ? '#fffbeb' : '#f0fdf4',
      border: `2px solid ${confirmed ? '#fde68a' : '#bbf7d0'}`,
      borderRadius: 8, padding: 16, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#166534', fontSize: 14 }}>
            Status: Active
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {clinicianName} is currently on shift
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {confirmed && (
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 16px', background: '#fff', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleClick}
            disabled={submitting}
            style={{
              padding: '8px 20px',
              background: confirmed ? '#dc2626' : '#ef4444',
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {submitting ? 'Processing...' : confirmed ? 'Confirm Call Off' : 'Report Call Off'}
          </button>
        </div>
      </div>
      {confirmed && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 4, fontSize: 13, color: '#92400e' }}>
          This will mark {clinicianName} as unavailable and notify all connected systems.
          Affected patient visits will need reassignment.
        </div>
      )}
    </div>
  );
}
