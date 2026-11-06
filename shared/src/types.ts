export type SourceSystem = 'ehr' | 'hr' | 'scheduling';
export type EntityType = 'clinician' | 'patient';
export type Role = 'admin' | 'nurse' | 'scheduler' | 'readonly';
export type NurseType = 'RN' | 'LPN';
export type Shift = '1st' | '2nd' | 'Nights';
export type ClinicianStatus = 'active' | 'called_off';
export type FieldOutcome = 'applied' | 'conflict_rejected' | 'validation_failed';

export interface FieldUpdate {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface SyncEvent {
  eventId: string;
  source: SourceSystem;
  entityType: EntityType;
  entityId: string;
  fields: FieldUpdate[];
  timestamp: string; // ISO 8601
  actorRole: Role;
  correlationId?: string;
}

export interface FieldResult {
  fieldName: string;
  outcome: FieldOutcome;
  reason?: string;
  appliedValue?: unknown;
}

export interface SyncResult {
  eventId: string;
  entityType: EntityType;
  entityId: string;
  fieldResults: FieldResult[];
  timestamp: string;
}

export interface AccessControl {
  role: Role;
  visibleFields: string[];
  redactedFields: string[];
}

export interface EventEnvelope {
  event: SyncResult;
  accessControl: AccessControl;
  entityData?: Record<string, unknown>;
}

export interface Clinician {
  id: string;
  employee_name: string;
  nurse_type: NurseType;
  phone_number: string;
  location: string;
  shift: Shift;
  certifications: string[];
  languages: string[];
  pet_allergies: string[];
  notes: string;
  status: ClinicianStatus;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  patient_name: string;
  address: string;
  phone_number: string;
  diagnosis: string;
  specialty_requirements: string[];
  pets_in_home: string[];
  staff_exceptions: string[];
  oriented_staff: string[];
  primary_clinician: string | null;
  secondary_clinician: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  event_id: string;
  entity_type: EntityType;
  entity_id: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  source_system: SourceSystem;
  timestamp: string;
  outcome: FieldOutcome;
  outcome_reason?: string;
  actor_role: Role;
  received_at: string;
}

export interface ValidationRule {
  id: number;
  entity_type: EntityType;
  field_name: string;
  rule_type: 'regex' | 'enum' | 'required' | 'custom';
  rule_config: Record<string, unknown>;
  message: string;
  active: boolean;
}

export interface NotesValidationResult {
  allow: boolean;
  reason: string;
  confidence: number;
}

export interface DLQEntry {
  id: string;
  original_topic: string;
  event_payload: SyncEvent;
  error_message: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  status: 'pending' | 'retrying' | 'exhausted';
  created_at: string;
  updated_at: string;
}
