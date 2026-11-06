import React, { useState, useEffect, useCallback } from 'react';
import { EventLog } from './EventLog';
import { useSocket } from '../hooks/useSocket';
import { fetchEntity, fetchAssignments, fetchAuditLog } from '../api';

const CLINICIAN_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PATIENT_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

interface StatusCard {
  label: string;
  value: string;
  color: string;
}

export function Dashboard() {
  const socket = useSocket('admin', 'dashboard');
  const [clinician, setClinician] = useState<Record<string, unknown>>({});
  const [patient, setPatient] = useState<Record<string, unknown>>({});
  const [assignedPatients, setAssignedPatients] = useState<Record<string, unknown>[]>([]);
  const [auditEntries, setAuditEntries] = useState<Record<string, unknown>[]>([]);

  const refreshTrigger = socket.lastUpdate?.event.timestamp || '';

  const loadData = useCallback(async () => {
    try {
      const [cResult, pResult, aResult] = await Promise.all([
        fetchEntity('clinician', CLINICIAN_ID, 'admin'),
        fetchEntity('patient', PATIENT_ID, 'admin'),
        fetchAssignments('clinician', CLINICIAN_ID, 'admin'),
      ]);
      setClinician(cResult.data);
      setPatient(pResult.data);
      setAssignedPatients(aResult.data);

      const [clinicianAudit, patientAudit] = await Promise.all([
        fetchAuditLog('clinician', CLINICIAN_ID),
        fetchAuditLog('patient', PATIENT_ID),
      ]);
      const combined = [...clinicianAudit.data, ...patientAudit.data] as Record<string, unknown>[];
      combined.sort((a, b) => new Date(b.received_at as string).getTime() - new Date(a.received_at as string).getTime());
      setAuditEntries(combined);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshTrigger]);

  const isCalledOff = clinician.status === 'called_off';

  const cards: StatusCard[] = [
    {
      label: 'Clinician Status',
      value: isCalledOff ? 'CALLED OFF' : 'Active',
      color: isCalledOff ? '#dc2626' : '#16a34a',
    },
    {
      label: 'Assigned Patients',
      value: String(assignedPatients.length),
      color: '#2563eb',
    },
    {
      label: 'Events Processed',
      value: String(socket.eventLog.length),
      color: '#7c3aed',
    },
    {
      label: 'Connection',
      value: socket.connected ? 'Live' : 'Disconnected',
      color: socket.connected ? '#16a34a' : '#dc2626',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#1a1a2e', padding: '12px 24px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, color: '#f9fafb' }}>Operations Dashboard</h1>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Real-time event stream | All systems
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: socket.connected ? '#4ade80' : '#f87171', marginRight: 4,
          }} />
          {socket.connected ? 'Streaming' : 'Disconnected'}
        </div>
      </header>

      {/* Call-off alert banner */}
      {isCalledOff && (
        <div style={{
          background: '#7f1d1d', borderBottom: '1px solid #991b1b',
          padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>!</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              ALERT: {String(clinician.employee_name)} has called off
            </div>
            <div style={{ fontSize: 12, color: '#fecaca', marginTop: 2 }}>
              {assignedPatients.length} patient visit(s) affected — coverage needed
            </div>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '16px 24px' }}>
        {cards.map((card) => (
          <div key={card.label} style={{
            background: '#1f2937', borderRadius: 8, padding: 16,
            border: '1px solid #374151',
          }}>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color, marginTop: 4 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Affected patients (only when called off) */}
      {isCalledOff && assignedPatients.length > 0 && (
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #374151', fontWeight: 600, fontSize: 14, color: '#fbbf24' }}>
              Affected Patient Visits — Need Coverage
            </div>
            {assignedPatients.map((p, i) => (
              <div key={i} style={{
                padding: '10px 16px', borderBottom: i < assignedPatients.length - 1 ? '1px solid #374151' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{String(p.patient_name)}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {String(p.address || '')} | {(p.specialty_requirements as string[] || []).join(', ')}
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px', background: '#7f1d1d', borderRadius: 12,
                  fontSize: 11, fontWeight: 600, color: '#fecaca',
                }}>
                  NEEDS COVERAGE
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Entity States */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '0 24px 16px' }}>
        <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>Clinician: {String(clinician.employee_name || '...')}</div>
          {[
            ['Type', clinician.nurse_type],
            ['Phone', clinician.phone_number],
            ['Shift', clinician.shift],
            ['Location', clinician.location],
            ['Status', clinician.status],
          ].map(([label, val]) => (
            <div key={String(label)} style={{ display: 'flex', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: '#6b7280', minWidth: 80 }}>{String(label)}:</span>
              <span style={{ color: String(label) === 'Status' && val === 'called_off' ? '#ef4444' : '#d1d5db', fontWeight: String(label) === 'Status' ? 600 : 400 }}>
                {String(val || '—')}
              </span>
            </div>
          ))}
        </div>
        <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>Patient: {String(patient.patient_name || '...')}</div>
          {[
            ['Phone', patient.phone_number],
            ['Address', patient.address],
            ['Diagnosis', patient.diagnosis],
            ['Specialty', (patient.specialty_requirements as string[] || []).join(', ')],
            ['Pets', (patient.pets_in_home as string[] || []).join(', ')],
          ].map(([label, val]) => (
            <div key={String(label)} style={{ display: 'flex', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: '#6b7280', minWidth: 80 }}>{String(label)}:</span>
              <span style={{ color: '#d1d5db' }}>{String(val || '—')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Event Stream */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #374151', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Live Event Stream</span>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
              {socket.eventLog.length} events captured this session
            </span>
          </div>
          <div style={{ background: '#111827' }}>
            <EventLog events={socket.eventLog} />
          </div>
        </div>
      </div>

      {/* Audit Log (persisted history) */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #374151', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Audit Log</span>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
              {auditEntries.length} records (persisted)
            </span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto', background: '#111827' }}>
            {auditEntries.length === 0 ? (
              <div style={{ padding: 16, color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>
                No audit entries yet.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #374151', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', color: '#9ca3af' }}>Time</th>
                    <th style={{ padding: '8px 12px', color: '#9ca3af' }}>Source</th>
                    <th style={{ padding: '8px 12px', color: '#9ca3af' }}>Entity</th>
                    <th style={{ padding: '8px 12px', color: '#9ca3af' }}>Field</th>
                    <th style={{ padding: '8px 12px', color: '#9ca3af' }}>Old → New</th>
                    <th style={{ padding: '8px 12px', color: '#9ca3af' }}>Outcome</th>
                    <th style={{ padding: '8px 12px', color: '#9ca3af' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry, i) => {
                    const outcome = String(entry.outcome);
                    const outcomeColor = outcome === 'applied' ? '#4ade80'
                      : outcome === 'conflict_rejected' ? '#fbbf24'
                      : '#f87171';
                    const oldVal = entry.old_value != null ? JSON.stringify(entry.old_value) : '—';
                    const newVal = entry.new_value != null ? JSON.stringify(entry.new_value) : '—';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {new Date(entry.received_at as string).toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#d1d5db' }}>
                          {String(entry.source_system)}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#d1d5db' }}>
                          {String(entry.entity_type)}
                        </td>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: '#d1d5db' }}>
                          {String(entry.field_name)}
                        </td>
                        <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {oldVal} → {newVal}
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <span style={{ color: outcomeColor, fontWeight: 600 }}>
                            {outcome === 'applied' ? 'Applied' : outcome === 'conflict_rejected' ? 'Conflict' : 'Failed'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 12px', fontSize: 11, color: '#9ca3af', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {String(entry.outcome_reason || '')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
