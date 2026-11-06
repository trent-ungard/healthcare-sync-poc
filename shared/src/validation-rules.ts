export type RuleType = 'regex' | 'enum' | 'required' | 'custom';

export interface RuleConfig {
  pattern?: string;
  values?: string[];
  fn?: string;
}

export const ENTITY_FIELDS: Record<string, string[]> = {
  clinician: [
    'employee_name', 'nurse_type', 'phone_number', 'location',
    'shift', 'certifications', 'languages', 'pet_allergies', 'notes', 'status',
  ],
  patient: [
    'patient_name', 'address', 'phone_number', 'diagnosis',
    'specialty_requirements', 'pets_in_home', 'staff_exceptions',
    'oriented_staff', 'primary_clinician', 'secondary_clinician', 'notes',
  ],
};

export const AI_CHECK_FIELDS = new Set([
  'shift', 'certifications', 'specialty_requirements',
  'staff_exceptions', 'diagnosis', 'notes',
]);
