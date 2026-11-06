import React, { useState, useEffect, useCallback } from 'react';
import { SystemPanel } from './components/SystemPanel';
import { AssignmentCard } from './components/AssignmentCard';
import { CallOffButton } from './components/CallOffButton';
import { Dashboard } from './components/Dashboard';
import { EventLog } from './components/EventLog';
import { ConflictBanner } from './components/ConflictBanner';
import { RoleDropdown } from './components/RoleDropdown';
import { useSocket } from './hooks/useSocket';
import { useRole } from './hooks/useRole';
import { fetchAssignments, fetchEntity, fetchClinicianById, fetchAllClinicians } from './api';

const CLINICIAN_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PATIENT_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

const SYSTEM_SOURCE = import.meta.env.VITE_SYSTEM_SOURCE || 'ehr';
const SYSTEM_NAME = import.meta.env.VITE_SYSTEM_NAME || 'Electronic Health Records';
const SYSTEM_COLOR = import.meta.env.VITE_SYSTEM_COLOR || '#1e3a5f';
const IS_DASHBOARD = import.meta.env.VITE_DASHBOARD_MODE === 'true';

const isEHR = SYSTEM_SOURCE === 'ehr';

const CLINICIAN_DISPLAY_FIELDS = [
  { key: 'employee_name', label: 'Name' },
  { key: 'nurse_type', label: 'Type' },
  { key: 'phone_number', label: 'Phone' },
  { key: 'shift', label: 'Shift' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'languages', label: 'Languages' },
  { key: 'pet_allergies', label: 'Pet Allergies' },
  { key: 'status', label: 'Status' },
];

const PATIENT_DISPLAY_FIELDS = [
  { key: 'patient_name', label: 'Name' },
  { key: 'phone_number', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'specialty_requirements', label: 'Specialty Req.' },
  { key: 'pets_in_home', label: 'Pets in Home' },
];

function AppInner() {
  const { role, changeRole } = useRole();
  const socket = useSocket(role, SYSTEM_SOURCE);
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([]);
  const [primaryClinician, setPrimaryClinician] = useState<Record<string, unknown> | null>(null);
  const [secondaryClinician, setSecondaryClinician] = useState<Record<string, unknown> | null>(null);
  const [allClinicians, setAllClinicians] = useState<Record<string, unknown>[]>([]);
  const [primaryClinicianId, setPrimaryClinicianId] = useState<string | null>(null);
  const [secondaryClinicianId, setSecondaryClinicianId] = useState<string | null>(null);
  const [clinicianStatus, setClinicianStatus] = useState('active');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [statusRefresh, setStatusRefresh] = useState(0);

  const primaryEntityType = isEHR ? 'patient' : 'clinician';
  const primaryEntityId = isEHR ? PATIENT_ID : CLINICIAN_ID;

  const refreshTrigger = socket.lastUpdate?.event.timestamp || '';

  const loadAssignments = useCallback(async () => {
    try {
      const result = await fetchAssignments(primaryEntityType, primaryEntityId, role);
      setAssignments(result.data);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    }
  }, [primaryEntityType, primaryEntityId, role]);

  const loadClinicianAssignments = useCallback(async () => {
    if (!isEHR) return;
    try {
      const [patient, clinicians] = await Promise.all([
        fetchEntity('patient', PATIENT_ID, role),
        fetchAllClinicians(role),
      ]);
      const pId = patient.data.primary_clinician as string | null;
      const sId = patient.data.secondary_clinician as string | null;
      setPrimaryClinicianId(pId);
      setSecondaryClinicianId(sId);
      setPrimaryClinician(pId ? await fetchClinicianById(pId, role) : null);
      setSecondaryClinician(sId ? await fetchClinicianById(sId, role) : null);
      setAllClinicians(clinicians);
    } catch (err) {
      console.error('Failed to load clinician assignments:', err);
    }
  }, [role]);

  const loadClinicianStatus = useCallback(async () => {
    if (isEHR) return;
    try {
      const result = await fetchEntity('clinician', CLINICIAN_ID, role);
      setClinicianStatus((result.data.status as string) || 'active');
    } catch (err) {
      console.error('Failed to load clinician status:', err);
    }
  }, [role]);

  useEffect(() => { loadAssignments(); }, [loadAssignments, refreshTrigger]);
  useEffect(() => { loadClinicianAssignments(); }, [loadClinicianAssignments, refreshTrigger, statusRefresh]);
  useEffect(() => { loadClinicianStatus(); }, [loadClinicianStatus, refreshTrigger, statusRefresh]);

  const lastError = socket.lastError;

  const primaryIsCalledOff = primaryClinician?.status === 'called_off';

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: SYSTEM_COLOR, color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>{SYSTEM_NAME}</h1>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            {isEHR ? 'Patient Records' : 'Staff Management'} | Connected to Healthcare Sync
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 12 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: socket.connected ? '#4ade80' : '#f87171', marginRight: 4,
            }} />
            {socket.connected ? 'Live' : 'Disconnected'}
          </div>
          <RoleDropdown role={role} onChange={changeRole} />
        </div>
      </header>

      {/* Context bar */}
      <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
          {isEHR ? 'Patient: Robert Williams' : 'Clinician: Sarah Johnson'}
        </span>
        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 12 }}>
          ID: {primaryEntityId.slice(0, 8)}...
        </span>
      </div>

      {/* Conflict Banner */}
      {lastError && !bannerDismissed && (
        <div style={{ padding: '0 24px', marginTop: 12 }}>
          <ConflictBanner
            fieldResults={lastError.event.fieldResults}
            onDismiss={() => setBannerDismissed(true)}
          />
        </div>
      )}

      {/* Call Off Button (HR only) */}
      {!isEHR && (
        <div style={{ padding: '16px 24px 0' }}>
          <CallOffButton
            clinicianId={CLINICIAN_ID}
            clinicianName="Sarah Johnson"
            currentStatus={clinicianStatus}
            role={role}
            sourceId={SYSTEM_SOURCE}
            onStatusChange={() => setStatusRefresh((n) => n + 1)}
          />
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24, alignItems: 'start' }}>
        {/* Left: Editable primary entity */}
        <SystemPanel
          systemName={isEHR ? 'Patient Record' : 'Employee Profile'}
          sourceId={SYSTEM_SOURCE}
          entityType={primaryEntityType}
          entityId={primaryEntityId}
          role={role}
          refreshTrigger={refreshTrigger.length}
        />

        {/* Right: Read-only assignments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isEHR ? (
            <>
              {/* EHR: Show primary and secondary clinician, then the rest */}
              <ClinicianAssignmentCard
                label="Primary Clinician"
                clinician={primaryClinician}
                isCalledOff={primaryIsCalledOff}
                displayFields={CLINICIAN_DISPLAY_FIELDS}
              />
              <ClinicianAssignmentCard
                label="Secondary Clinician (Backup)"
                clinician={secondaryClinician}
                isCalledOff={false}
                displayFields={CLINICIAN_DISPLAY_FIELDS}
              />
              {(() => {
                const otherClinicians = allClinicians.filter(
                  (c) => c.id !== primaryClinicianId && c.id !== secondaryClinicianId,
                );
                if (otherClinicians.length === 0) return null;
                return (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#f9fafb' }}>
                    <h4 style={{ margin: '0 0 4px 0', color: '#374151', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Other Clinicians
                      <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                        ({otherClinicians.length} available)
                      </span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {otherClinicians.map((c, i) => (
                        <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>
                              {String(c.employee_name)}
                            </span>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                              background: c.status === 'called_off' ? '#fef2f2' : '#f0fdf4',
                              color: c.status === 'called_off' ? '#dc2626' : '#16a34a',
                            }}>
                              {c.status === 'called_off' ? 'Called Off' : 'Active'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {String(c.nurse_type)} | {String(c.shift)} shift | {String(c.location)}
                            {Array.isArray(c.certifications) && c.certifications.length > 0 && (
                              <span> | {c.certifications.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <AssignmentCard
              title="Assigned Patient(s)"
              records={assignments}
              displayFields={PATIENT_DISPLAY_FIELDS}
            />
          )}

          <div style={{
            border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#f9fafb',
            fontSize: 12, color: '#6b7280',
          }}>
            <strong style={{ color: '#374151' }}>How this works:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
              <li>Edit fields on the left and click Save</li>
              <li>Changes flow through Kafka to the sync service</li>
              <li>Validation rules and AI notes are checked</li>
              <li>Updates propagate to the other system in real time</li>
              <li>Open the {isEHR ? 'HR Platform' : 'EHR'} on port {isEHR ? '5174' : '5173'} to see it</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14, color: '#374151' }}>
            Event Log ({socket.eventLog.length} events)
          </div>
          <EventLog events={socket.eventLog} />
        </div>
      </div>
    </div>
  );
}

function ClinicianAssignmentCard({ label, clinician, isCalledOff, displayFields }: {
  label: string;
  clinician: Record<string, unknown> | null;
  isCalledOff: boolean;
  displayFields: { key: string; label: string }[];
}) {
  if (!clinician) {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#f9fafb' }}>
        <h4 style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>{label}</h4>
        <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 13, marginTop: 8 }}>
          No clinician assigned
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: `2px solid ${isCalledOff ? '#fecaca' : '#e5e7eb'}`,
      borderRadius: 8, padding: 16,
      background: isCalledOff ? '#fef2f2' : '#f9fafb',
    }}>
      <h4 style={{ margin: '0 0 4px 0', color: '#374151', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        {label}
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
          (read-only — managed by HR)
        </span>
      </h4>
      {isCalledOff && (
        <div style={{
          background: '#dc2626', color: '#fff', padding: '4px 10px', borderRadius: 4,
          fontSize: 12, fontWeight: 700, display: 'inline-block', marginBottom: 8,
        }}>
          CALLED OFF — Reassignment in progress
        </div>
      )}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12 }}>
        {displayFields.map(({ key, label: fieldLabel }) => {
          const value = clinician[key];
          if (value === undefined) return null;
          const display = Array.isArray(value) ? value.join(', ') : String(value ?? '');
          const isStatus = key === 'status';
          return (
            <div key={key} style={{ display: 'flex', marginBottom: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#6b7280', minWidth: 140 }}>{fieldLabel}:</span>
              <span style={{
                color: isStatus && value === 'called_off' ? '#dc2626'
                  : isStatus && value === 'active' ? '#16a34a'
                  : '#1f2937',
                fontWeight: isStatus ? 700 : 400,
              }}>
                {display || '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  if (IS_DASHBOARD) return <Dashboard />;
  return <AppInner />;
}

export default App;
