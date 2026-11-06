import { pool } from './pool';
import type { Clinician, Patient, AuditEntry, ValidationRule, FieldUpdate, FieldOutcome, Role, SourceSystem, EntityType } from '../../../shared/src/types';

export async function getClinician(id: string): Promise<Clinician | null> {
  const result = await pool.query('SELECT * FROM clinicians WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function getPatient(id: string): Promise<Patient | null> {
  const result = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function getEntity(entityType: EntityType, id: string): Promise<Record<string, unknown> | null> {
  const table = entityType === 'clinician' ? 'clinicians' : 'patients';
  const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function updateEntityField(
  entityType: EntityType,
  entityId: string,
  fieldName: string,
  value: unknown,
): Promise<void> {
  const table = entityType === 'clinician' ? 'clinicians' : 'patients';
  const allowedFields = entityType === 'clinician'
    ? ['employee_name', 'nurse_type', 'phone_number', 'location', 'shift', 'certifications', 'languages', 'pet_allergies', 'notes', 'status']
    : ['patient_name', 'address', 'phone_number', 'diagnosis', 'specialty_requirements', 'pets_in_home', 'staff_exceptions', 'oriented_staff', 'primary_clinician', 'secondary_clinician', 'notes'];

  if (!allowedFields.includes(fieldName)) {
    throw new Error(`Invalid field: ${fieldName}`);
  }

  await pool.query(
    `UPDATE ${table} SET ${fieldName} = $1, updated_at = now() WHERE id = $2`,
    [value, entityId],
  );
}

export async function insertAuditLog(
  eventId: string,
  entityType: EntityType,
  entityId: string,
  field: FieldUpdate,
  sourceSystem: SourceSystem,
  timestamp: string,
  outcome: FieldOutcome,
  actorRole: Role,
  outcomeReason?: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (event_id, entity_type, entity_id, field_name, old_value, new_value, source_system, timestamp, outcome, outcome_reason, actor_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      eventId, entityType, entityId, field.fieldName,
      JSON.stringify(field.oldValue), JSON.stringify(field.newValue),
      sourceSystem, timestamp, outcome, outcomeReason ?? null, actorRole,
    ],
  );
}

export async function getAuditLog(entityType: EntityType, entityId: string, limit = 50): Promise<AuditEntry[]> {
  const result = await pool.query(
    'SELECT * FROM audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY received_at DESC LIMIT $3',
    [entityType, entityId, limit],
  );
  return result.rows;
}

export async function getValidationRules(): Promise<ValidationRule[]> {
  const result = await pool.query('SELECT * FROM validation_rules WHERE active = true');
  return result.rows;
}

export async function getPatientsForClinician(clinicianId: string): Promise<Patient[]> {
  const result = await pool.query(
    'SELECT * FROM patients WHERE $1 = ANY(oriented_staff)',
    [clinicianId],
  );
  return result.rows;
}

export async function getCliniciansForPatient(patientId: string): Promise<Clinician[]> {
  const result = await pool.query(
    'SELECT c.* FROM clinicians c JOIN patients p ON c.id = ANY(p.oriented_staff) WHERE p.id = $1',
    [patientId],
  );
  return result.rows;
}

export async function getPatientsByPrimaryClinician(clinicianId: string): Promise<Patient[]> {
  const result = await pool.query(
    'SELECT * FROM patients WHERE primary_clinician = $1',
    [clinicianId],
  );
  return result.rows;
}

export async function getAllClinicians(): Promise<Clinician[]> {
  const result = await pool.query('SELECT * FROM clinicians ORDER BY employee_name');
  return result.rows;
}

export async function getFieldTimestamps(entityType: EntityType, entityId: string): Promise<Record<string, { updated_at: string; source_system: string }>> {
  const result = await pool.query(
    'SELECT field_name, updated_at, source_system FROM field_timestamps WHERE entity_type = $1 AND entity_id = $2',
    [entityType, entityId],
  );
  const map: Record<string, { updated_at: string; source_system: string }> = {};
  for (const row of result.rows) {
    map[row.field_name] = { updated_at: row.updated_at, source_system: row.source_system };
  }
  return map;
}
