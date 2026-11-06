import React, { useState, useEffect, useCallback } from 'react';
import { fetchEntity, submitEvent } from '../api';

interface FieldTimestamp {
  updated_at: string;
  source_system: string;
}

interface Props {
  systemName: string;
  sourceId: string;
  entityType: string;
  entityId: string;
  role: string;
  refreshTrigger: number;
}

const FIELD_LABELS: Record<string, string> = {
  employee_name: 'Employee Name',
  nurse_type: 'Nurse Type',
  phone_number: 'Phone Number',
  location: 'Location',
  shift: 'Shift',
  certifications: 'Certifications',
  languages: 'Languages',
  pet_allergies: 'Pet Allergies',
  notes: 'Notes',
  patient_name: 'Patient Name',
  address: 'Address',
  diagnosis: 'Diagnosis',
  specialty_requirements: 'Specialty Requirements',
  pets_in_home: 'Pets in Home',
  staff_exceptions: 'Staff Exceptions',
  oriented_staff: 'Orientated Staff',
};

const EDITABLE_FIELDS: Record<string, string[]> = {
  clinician: ['employee_name', 'nurse_type', 'phone_number', 'location', 'shift', 'certifications', 'languages', 'pet_allergies', 'notes'],
  patient: ['patient_name', 'address', 'phone_number', 'diagnosis', 'specialty_requirements', 'pets_in_home', 'notes'],
};

export function SystemPanel({ systemName, sourceId, entityType, entityId, role, refreshTrigger }: Props) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [redacted, setRedacted] = useState<string[]>([]);
  const [timestamps, setTimestamps] = useState<Record<string, FieldTimestamp>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const result = await fetchEntity(entityType, entityId, role);
      setData(result.data);
      setRedacted(result.redactedFields);
      setTimestamps(result.fieldTimestamps);
      const edits: Record<string, string> = {};
      for (const [key, value] of Object.entries(result.data)) {
        if (Array.isArray(value)) {
          edits[key] = value.join(', ');
        } else {
          edits[key] = String(value ?? '');
        }
      }
      setEditValues(edits);
      setDirtyFields(new Set());
    } catch (err) {
      console.error('Failed to load entity:', err);
    }
  }, [entityType, entityId, role]);

  useEffect(() => { loadData(); }, [loadData, refreshTrigger]);

  const handleFieldChange = (fieldName: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [fieldName]: value }));
    setDirtyFields((prev) => new Set(prev).add(fieldName));
  };

  const handleSubmit = async () => {
    if (dirtyFields.size === 0) return;
    setSubmitting(true);
    setStatus(null);

    const fields = Array.from(dirtyFields).map((fn: string) => {
      const isArray = Array.isArray(data[fn]);
      const newValue = isArray
        ? editValues[fn].split(',').map((s: string) => s.trim()).filter(Boolean)
        : editValues[fn];
      return { fieldName: fn, oldValue: data[fn], newValue };
    });

    try {
      const result = await submitEvent({
        source: sourceId,
        entityType,
        entityId,
        fields,
        actorRole: role,
      });
      setStatus({ type: 'success', message: `Event ${result.eventId.slice(0, 8)} submitted` });
      setDirtyFields(new Set());
      setTimeout(() => loadData(), 500);
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const editableFields = EDITABLE_FIELDS[entityType] || [];

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#1f2937' }}>{systemName}</h3>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Source: <strong>{sourceId}</strong> | Entity: <strong>{entityType}/{entityId.slice(0, 8)}</strong>
      </div>

      {status && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            marginBottom: 12,
            background: status.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: status.type === 'success' ? '#16a34a' : '#dc2626',
            fontSize: 13,
          }}
        >
          {status.message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {editableFields.map((fieldName) => {
          if (redacted.includes(fieldName)) {
            return (
              <div key={fieldName}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  {FIELD_LABELS[fieldName] || fieldName}
                </label>
                <div style={{ padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>
                  [REDACTED - insufficient permissions]
                </div>
              </div>
            );
          }

          const isDirty = dirtyFields.has(fieldName);
          const ts = timestamps[fieldName];
          const isTextArea = fieldName === 'notes';

          return (
            <div key={fieldName}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                {FIELD_LABELS[fieldName] || fieldName}
                {isDirty && <span style={{ color: '#f59e0b', marginLeft: 8 }}>*modified</span>}
              </label>
              {isTextArea ? (
                <textarea
                  value={editValues[fieldName] ?? ''}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${isDirty ? '#f59e0b' : '#d1d5db'}`,
                    borderRadius: 4,
                    fontSize: 14,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={editValues[fieldName] ?? ''}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${isDirty ? '#f59e0b' : '#d1d5db'}`,
                    borderRadius: 4,
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              )}
              {ts && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  Last updated by <strong>{ts.source_system}</strong> at {new Date(ts.updated_at).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={dirtyFields.size === 0 || submitting}
        style={{
          marginTop: 16,
          padding: '10px 24px',
          background: dirtyFields.size > 0 ? '#2563eb' : '#9ca3af',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor: dirtyFields.size > 0 ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'Submitting...' : `Save Changes (${dirtyFields.size})`}
      </button>
    </div>
  );
}
