CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clinician Profile
CREATE TABLE clinicians (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_name  TEXT NOT NULL,
  nurse_type     TEXT CHECK (nurse_type IN ('RN', 'LPN')),
  phone_number   TEXT,
  location       TEXT,
  shift          TEXT CHECK (shift IN ('1st', '2nd', 'Nights')),
  certifications TEXT[],
  languages      TEXT[],
  pet_allergies  TEXT[],
  notes          TEXT,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'called_off')),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Patient Profile
CREATE TABLE patients (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_name           TEXT NOT NULL,
  address                TEXT,
  phone_number           TEXT,
  diagnosis              TEXT,
  specialty_requirements TEXT[],
  pets_in_home           TEXT[],
  staff_exceptions       UUID[],
  oriented_staff         UUID[],
  primary_clinician      UUID REFERENCES clinicians(id),
  secondary_clinician    UUID REFERENCES clinicians(id),
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- LWW Field Timestamps (CRDT core)
CREATE TABLE field_timestamps (
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  field_name    TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,
  source_system TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id, field_name)
);

-- Audit Log (append-only)
CREATE TABLE audit_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id       UUID NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      UUID NOT NULL,
  field_name     TEXT NOT NULL,
  old_value      JSONB,
  new_value      JSONB,
  source_system  TEXT NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL,
  outcome        TEXT NOT NULL,
  outcome_reason TEXT,
  actor_role     TEXT,
  received_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_event ON audit_log (event_id);

-- Validation Rules
CREATE TABLE validation_rules (
  id          SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  field_name  TEXT NOT NULL,
  rule_type   TEXT NOT NULL,
  rule_config JSONB NOT NULL,
  message     TEXT NOT NULL,
  active      BOOLEAN DEFAULT true
);

INSERT INTO validation_rules (entity_type, field_name, rule_type, rule_config, message) VALUES
  ('clinician', 'phone_number', 'regex', '{"pattern": "^\\d{3}-\\d{3}-\\d{4}$"}', 'Phone must be XXX-XXX-XXXX format'),
  ('clinician', 'nurse_type', 'enum', '{"values": ["RN", "LPN"]}', 'Nurse type must be RN or LPN'),
  ('clinician', 'shift', 'enum', '{"values": ["1st", "2nd", "Nights"]}', 'Shift must be 1st, 2nd, or Nights'),
  ('clinician', 'status', 'enum', '{"values": ["active", "called_off"]}', 'Status must be active or called_off'),
  ('patient', 'phone_number', 'regex', '{"pattern": "^\\d{3}-\\d{3}-\\d{4}$"}', 'Phone must be XXX-XXX-XXXX format'),
  ('clinician', 'employee_name', 'required', '{}', 'Employee name is required'),
  ('patient', 'patient_name', 'required', '{}', 'Patient name is required');

-- Dead Letter Queue
CREATE TABLE dead_letter_queue (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_topic TEXT NOT NULL,
  event_payload  JSONB NOT NULL,
  error_message  TEXT NOT NULL,
  retry_count    INT DEFAULT 0,
  max_retries    INT DEFAULT 3,
  next_retry_at  TIMESTAMPTZ,
  status         TEXT DEFAULT 'pending',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Seed Data
INSERT INTO clinicians (id, employee_name, nurse_type, phone_number, location, shift, certifications, languages, pet_allergies, notes)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Sarah Johnson', 'RN', '555-123-4567', 'District 7', '1st',
  ARRAY['Pediatrics', 'Wound Care'], ARRAY['English', 'Spanish'],
  ARRAY['Cats'],
  'Sarah prefers morning shifts and has expressed she does not want to work weekends. She is experienced with ventilator patients but her certification expired last month.'
);

INSERT INTO clinicians (id, employee_name, nurse_type, phone_number, location, shift, certifications, languages, pet_allergies, notes)
VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'Maria Garcia', 'LPN', '555-234-5678', 'District 7', '1st',
  ARRAY['Pediatrics', 'Ventilator', 'Wound Care'], ARRAY['English', 'Spanish', 'Portuguese'],
  ARRAY[]::TEXT[],
  'Maria is very reliable and has no scheduling restrictions. She has been oriented to all District 7 patients and is comfortable with ventilator care.'
);

INSERT INTO clinicians (id, employee_name, nurse_type, phone_number, location, shift, certifications, languages, pet_allergies, notes)
VALUES (
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  'James Chen', 'RN', '555-345-6789', 'District 7', '2nd',
  ARRAY['Ventilator', 'Wound Care', 'Pediatrics'], ARRAY['English', 'Mandarin'],
  ARRAY[]::TEXT[],
  'James has 12 years of ICU experience. He is available for overtime and cross-district coverage. Prefers 2nd shift but flexible when needed.'
);

INSERT INTO clinicians (id, employee_name, nurse_type, phone_number, location, shift, certifications, languages, pet_allergies, notes)
VALUES (
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
  'Priya Patel', 'RN', '555-456-7890', 'District 3', '1st',
  ARRAY['Pediatrics', 'Wound Care'], ARRAY['English', 'Hindi', 'Gujarati'],
  ARRAY['Dogs'],
  'Priya is new to the district and still completing orientation for most patients. She has strong pediatric skills and is eager to pick up extra shifts.'
);

INSERT INTO clinicians (id, employee_name, nurse_type, phone_number, location, shift, certifications, languages, pet_allergies, notes)
VALUES (
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
  'Angela Thompson', 'LPN', '555-567-8901', 'District 7', 'Nights',
  ARRAY['Wound Care'], ARRAY['English'],
  ARRAY[]::TEXT[],
  'Angela works nights exclusively due to childcare. She cannot be reassigned to day shifts. Reliable and experienced with long-term wound care patients.'
);

INSERT INTO patients (id, patient_name, address, phone_number, diagnosis, specialty_requirements, pets_in_home, staff_exceptions, oriented_staff, primary_clinician, secondary_clinician, notes)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'Robert Williams', '123 Oak Street, Springfield', '555-987-6543',
  'COPD Stage 3', ARRAY['Ventilator'], ARRAY['Dog (Golden Retriever)', 'Cat (Tabby)'],
  ARRAY[]::UUID[],
  ARRAY['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33']::UUID[],
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  'Patient is hard of hearing — staff must speak loudly and clearly. Family requests no male nurses due to patient preference. Patient becomes agitated if routine is disrupted; adhere strictly to care schedule.'
);

-- Seed field timestamps for LWW
INSERT INTO field_timestamps (entity_type, entity_id, field_name, updated_at, source_system)
SELECT 'clinician', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID, col, now(), 'hr'
FROM unnest(ARRAY['employee_name','nurse_type','phone_number','location','shift','certifications','languages','pet_allergies','notes','status']) AS col;

INSERT INTO field_timestamps (entity_type, entity_id, field_name, updated_at, source_system)
SELECT 'clinician', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'::UUID, col, now(), 'hr'
FROM unnest(ARRAY['employee_name','nurse_type','phone_number','location','shift','certifications','languages','pet_allergies','notes','status']) AS col;

INSERT INTO field_timestamps (entity_type, entity_id, field_name, updated_at, source_system)
SELECT 'clinician', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44'::UUID, col, now(), 'hr'
FROM unnest(ARRAY['employee_name','nurse_type','phone_number','location','shift','certifications','languages','pet_allergies','notes','status']) AS col;

INSERT INTO field_timestamps (entity_type, entity_id, field_name, updated_at, source_system)
SELECT 'clinician', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55'::UUID, col, now(), 'hr'
FROM unnest(ARRAY['employee_name','nurse_type','phone_number','location','shift','certifications','languages','pet_allergies','notes','status']) AS col;

INSERT INTO field_timestamps (entity_type, entity_id, field_name, updated_at, source_system)
SELECT 'clinician', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66'::UUID, col, now(), 'hr'
FROM unnest(ARRAY['employee_name','nurse_type','phone_number','location','shift','certifications','languages','pet_allergies','notes','status']) AS col;

INSERT INTO field_timestamps (entity_type, entity_id, field_name, updated_at, source_system)
SELECT 'patient', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'::UUID, col, now(), 'ehr'
FROM unnest(ARRAY['patient_name','address','phone_number','diagnosis','specialty_requirements','pets_in_home','staff_exceptions','oriented_staff','primary_clinician','secondary_clinician','notes']) AS col;
