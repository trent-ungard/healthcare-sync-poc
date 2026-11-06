import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getClinician, getPatient, getAuditLog, getFieldTimestamps, getPatientsForClinician, getCliniciansForPatient, getAllClinicians } from '../db/queries';
import { filterFieldsForRole, getRedactedFields } from '../../../shared/src/permissions';
import { ENTITY_FIELDS } from '../../../shared/src/validation-rules';
import { SOURCE_TO_INBOUND } from '../../../shared/src/topics';
import { produce } from '../kafka/producer';
import type { Role, EntityType, SyncEvent } from '../../../shared/src/types';

export const apiRouter = Router();

function getRoleFromHeader(req: Request): Role {
  const role = req.headers['x-user-role'] as string;
  if (['admin', 'nurse', 'scheduler', 'readonly'].includes(role)) return role as Role;
  return 'readonly';
}

apiRouter.get('/clinicians', async (req: Request, res: Response) => {
  const role = getRoleFromHeader(req);
  const clinicians = await getAllClinicians();
  const filtered = clinicians.map((c) => filterFieldsForRole(role, 'clinician', c as unknown as Record<string, unknown>));
  res.json({ data: filtered });
});

apiRouter.get('/clinicians/:id', async (req: Request, res: Response) => {
  const role = getRoleFromHeader(req);
  const clinician = await getClinician(req.params.id);
  if (!clinician) return res.status(404).json({ error: 'Clinician not found' });

  const timestamps = await getFieldTimestamps('clinician', req.params.id);
  const filtered = filterFieldsForRole(role, 'clinician', clinician as unknown as Record<string, unknown>);
  const redacted = getRedactedFields(role, 'clinician', ENTITY_FIELDS.clinician);

  res.json({ data: filtered, redactedFields: redacted, fieldTimestamps: timestamps });
});

apiRouter.get('/patients/:id', async (req: Request, res: Response) => {
  const role = getRoleFromHeader(req);
  const patient = await getPatient(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const timestamps = await getFieldTimestamps('patient', req.params.id);
  const filtered = filterFieldsForRole(role, 'patient', patient as unknown as Record<string, unknown>);
  const redacted = getRedactedFields(role, 'patient', ENTITY_FIELDS.patient);

  res.json({ data: filtered, redactedFields: redacted, fieldTimestamps: timestamps });
});

apiRouter.get('/audit/:entityType/:entityId', async (req: Request, res: Response) => {
  const { entityType, entityId } = req.params;
  if (entityType !== 'clinician' && entityType !== 'patient') {
    return res.status(400).json({ error: 'entityType must be clinician or patient' });
  }
  const entries = await getAuditLog(entityType as EntityType, entityId);
  res.json({ data: entries });
});

apiRouter.get('/clinicians/:id/patients', async (req: Request, res: Response) => {
  const role = getRoleFromHeader(req);
  const patients = await getPatientsForClinician(req.params.id);
  const filtered = patients.map((p) => filterFieldsForRole(role, 'patient', p as unknown as Record<string, unknown>));
  res.json({ data: filtered });
});

apiRouter.get('/patients/:id/clinicians', async (req: Request, res: Response) => {
  const role = getRoleFromHeader(req);
  const clinicians = await getCliniciansForPatient(req.params.id);
  const filtered = clinicians.map((c) => filterFieldsForRole(role, 'clinician', c as unknown as Record<string, unknown>));
  res.json({ data: filtered });
});

apiRouter.get('/entities', async (_req: Request, res: Response) => {
  const clinicians = await getAllClinicians();
  res.json({
    clinicians: clinicians.map((c) => ({ id: c.id, name: c.employee_name, status: c.status })),
    patients: [{ id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', name: 'Robert Williams' }],
  });
});

apiRouter.post('/events', async (req: Request, res: Response) => {
  const { source, entityType, entityId, fields, actorRole } = req.body;

  if (!source || !entityType || !entityId || !fields?.length) {
    return res.status(400).json({ error: 'Missing required fields: source, entityType, entityId, fields' });
  }

  const topic = SOURCE_TO_INBOUND[source];
  if (!topic) {
    return res.status(400).json({ error: `Invalid source: ${source}` });
  }

  const event: SyncEvent = {
    eventId: uuidv4(),
    source,
    entityType,
    entityId,
    fields,
    timestamp: new Date().toISOString(),
    actorRole: actorRole || getRoleFromHeader(req),
    correlationId: uuidv4(),
  };

  try {
    await produce(topic, entityId, event);
    res.json({ accepted: true, eventId: event.eventId });
  } catch (err) {
    console.error('[API] Failed to produce event:', (err as Error).message);
    res.status(500).json({ error: 'Failed to queue event', message: (err as Error).message });
  }
});
