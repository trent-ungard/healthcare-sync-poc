const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchEntity(
  entityType: string,
  entityId: string,
  role: string,
): Promise<{ data: Record<string, unknown>; redactedFields: string[]; fieldTimestamps: Record<string, { updated_at: string; source_system: string }> }> {
  const endpoint = entityType === 'clinician' ? 'clinicians' : 'patients';
  const res = await fetch(`${API_BASE}/api/${endpoint}/${entityId}`, {
    headers: { 'X-User-Role': role },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${entityType}: ${res.statusText}`);
  return res.json();
}

export async function submitEvent(payload: {
  source: string;
  entityType: string;
  entityId: string;
  fields: { fieldName: string; oldValue: unknown; newValue: unknown }[];
  actorRole: string;
}): Promise<{ accepted: boolean; eventId: string }> {
  const res = await fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to submit event');
  }
  return res.json();
}

export async function fetchAssignments(
  entityType: string,
  entityId: string,
  role: string,
): Promise<{ data: Record<string, unknown>[] }> {
  const endpoint = entityType === 'clinician'
    ? `clinicians/${entityId}/patients`
    : `patients/${entityId}/clinicians`;
  const res = await fetch(`${API_BASE}/api/${endpoint}`, {
    headers: { 'X-User-Role': role },
  });
  if (!res.ok) throw new Error(`Failed to fetch assignments: ${res.statusText}`);
  return res.json();
}

export async function fetchAllClinicians(
  role: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${API_BASE}/api/clinicians`, {
    headers: { 'X-User-Role': role },
  });
  if (!res.ok) return [];
  const result = await res.json();
  return result.data;
}

export async function fetchClinicianById(
  id: string,
  role: string,
): Promise<Record<string, unknown> | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${API_BASE}/api/clinicians/${id}`, {
      headers: { 'X-User-Role': role },
    });
    if (!res.ok) return null;
    const result = await res.json();
    return result.data;
  } catch {
    return null;
  }
}

export async function fetchAuditLog(
  entityType: string,
  entityId: string,
): Promise<{ data: unknown[] }> {
  const res = await fetch(`${API_BASE}/api/audit/${entityType}/${entityId}`);
  if (!res.ok) throw new Error(`Failed to fetch audit log: ${res.statusText}`);
  return res.json();
}
