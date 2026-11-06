import { Role, EntityType } from './types';

const ALL = new Set(['*']);

const fieldVisibility: Record<Role, Record<EntityType, Set<string>>> = {
  admin: {
    clinician: ALL,
    patient: ALL,
  },
  nurse: {
    clinician: new Set([
      'employee_name', 'nurse_type', 'phone_number', 'location',
      'shift', 'certifications', 'languages', 'pet_allergies', 'status',
    ]),
    patient: new Set([
      'patient_name', 'address', 'phone_number',
      'specialty_requirements', 'pets_in_home',
      'oriented_staff', 'primary_clinician', 'secondary_clinician', 'notes',
    ]),
  },
  scheduler: {
    clinician: new Set([
      'employee_name', 'nurse_type', 'location', 'shift',
      'certifications', 'languages', 'pet_allergies', 'status',
    ]),
    patient: new Set([
      'patient_name', 'address', 'specialty_requirements',
      'pets_in_home', 'staff_exceptions', 'oriented_staff',
      'primary_clinician', 'secondary_clinician',
    ]),
  },
  readonly: {
    clinician: new Set(['employee_name', 'nurse_type', 'location']),
    patient: new Set(['patient_name']),
  },
};

const META_FIELDS = new Set(['id', 'created_at', 'updated_at']);

export function getVisibleFields(role: Role, entityType: EntityType): Set<string> {
  return fieldVisibility[role]?.[entityType] ?? new Set();
}

export function filterFieldsForRole<T extends Record<string, unknown>>(
  role: Role,
  entityType: EntityType,
  record: T,
): Partial<T> {
  const allowed = fieldVisibility[role]?.[entityType];
  if (!allowed) return {};
  if (allowed.has('*')) return record;

  const filtered: Partial<T> = {};
  for (const key of Object.keys(record)) {
    if (allowed.has(key) || META_FIELDS.has(key)) {
      (filtered as Record<string, unknown>)[key] = record[key];
    }
  }
  return filtered;
}

export function getRedactedFields(role: Role, entityType: EntityType, allFields: string[]): string[] {
  const allowed = fieldVisibility[role]?.[entityType];
  if (!allowed) return allFields;
  if (allowed.has('*')) return [];
  return allFields.filter(f => !allowed.has(f) && !META_FIELDS.has(f));
}
