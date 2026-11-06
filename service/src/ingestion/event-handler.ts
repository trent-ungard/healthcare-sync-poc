import { v4 as uuidv4 } from 'uuid';
import { validateField } from '../validation/engine';
import { validateAgainstNotes } from '../validation/ai-notes-mock';
import { mergeField } from '../crdt/lww-register';
import { getEntity, updateEntityField, insertAuditLog, getPatientsByPrimaryClinician, getClinician } from '../db/queries';
import { produce } from '../kafka/producer';
import { sendToDLQ } from '../kafka/dlq';
import { buildAccessControl } from '../permissions/tagger';
import { reportError, trackEvent, trackDuration } from '../monitoring/datadog';
import { SOURCE_TO_OUTBOUND, TOPICS } from '../../../shared/src/topics';
import { AI_CHECK_FIELDS } from '../../../shared/src/validation-rules';
import { filterFieldsForRole } from '../../../shared/src/permissions';
import { io } from '../index';
import type { SyncEvent, SyncResult, FieldResult, EventEnvelope } from '../../../shared/src/types';

export async function handleSyncEvent(event: SyncEvent): Promise<SyncResult> {
  const start = Date.now();
  trackEvent('event.received', { source: event.source, entity_type: event.entityType });

  const entity = await getEntity(event.entityType, event.entityId);
  if (!entity) {
    trackEvent('event.error', { reason: 'entity_not_found' });
    throw new Error(`Entity not found: ${event.entityType}/${event.entityId}`);
  }

  const notes = (entity.notes as string) || '';
  const fieldResults: FieldResult[] = [];

  for (const field of event.fields) {
    // Step 1: Explicit validation
    const validation = await validateField(event.entityType, field.fieldName, field.newValue);
    if (!validation.valid) {
      fieldResults.push({
        fieldName: field.fieldName,
        outcome: 'validation_failed',
        reason: validation.errors.join('; '),
      });
      await insertAuditLog(
        event.eventId, event.entityType, event.entityId, field,
        event.source, event.timestamp, 'validation_failed', event.actorRole,
        validation.errors.join('; '),
      );
      trackEvent('event.processed', { outcome: 'validation_failed', field: field.fieldName });
      continue;
    }

    // Step 2: AI notes check (conditional)
    if (notes && AI_CHECK_FIELDS.has(field.fieldName)) {
      try {
        const aiResult = await validateAgainstNotes(event.entityType, notes, field);
        if (!aiResult.allow && aiResult.confidence > 0.7) {
          fieldResults.push({
            fieldName: field.fieldName,
            outcome: 'validation_failed',
            reason: `AI: ${aiResult.reason}`,
          });
          await insertAuditLog(
            event.eventId, event.entityType, event.entityId, field,
            event.source, event.timestamp, 'validation_failed', event.actorRole,
            `AI (confidence: ${aiResult.confidence}): ${aiResult.reason}`,
          );
          trackEvent('validation.ai.denied', { field: field.fieldName });
          continue;
        }
        if (aiResult.reason !== 'No conflicts detected in notes.') {
          trackEvent('validation.ai.flagged', { field: field.fieldName });
        }
      } catch (err) {
        trackEvent('validation.ai.error');
        console.warn('[AI] Notes validation failed, allowing update:', (err as Error).message);
      }
    }

    // Step 3: CRDT merge
    const merge = await mergeField(
      event.entityType, event.entityId, field.fieldName,
      new Date(event.timestamp), event.source,
    );
    if (!merge.applied) {
      fieldResults.push({
        fieldName: field.fieldName,
        outcome: 'conflict_rejected',
        reason: merge.reason,
      });
      await insertAuditLog(
        event.eventId, event.entityType, event.entityId, field,
        event.source, event.timestamp, 'conflict_rejected', event.actorRole,
        merge.reason,
      );
      trackEvent('crdt.conflict', { field: field.fieldName });
      continue;
    }

    // Step 4: Persist
    await updateEntityField(event.entityType, event.entityId, field.fieldName, field.newValue);
    await insertAuditLog(
      event.eventId, event.entityType, event.entityId, field,
      event.source, event.timestamp, 'applied', event.actorRole,
    );
    fieldResults.push({
      fieldName: field.fieldName,
      outcome: 'applied',
      appliedValue: field.newValue,
    });
    trackEvent('event.processed', { outcome: 'applied', field: field.fieldName });
  }

  // Step 5: Auto-reassignment on call-off
  const statusField = event.fields.find((f) => f.fieldName === 'status');
  const statusApplied = fieldResults.find((f) => f.fieldName === 'status' && f.outcome === 'applied');
  if (event.entityType === 'clinician' && statusField && statusApplied && statusField.newValue === 'called_off') {
    await handleCallOffReassignment(event.entityId, event);
  }

  const duration = Date.now() - start;
  trackDuration('pipeline.duration_ms', duration, { entity_type: event.entityType });

  return {
    eventId: event.eventId,
    entityType: event.entityType,
    entityId: event.entityId,
    fieldResults,
    timestamp: event.timestamp,
  };
}

async function handleCallOffReassignment(clinicianId: string, originalEvent: SyncEvent): Promise<void> {
  const calledOffClinician = await getClinician(clinicianId);
  const affectedPatients = await getPatientsByPrimaryClinician(clinicianId);
  console.log(`[Reassignment] ${calledOffClinician?.employee_name ?? clinicianId} called off. ${affectedPatients.length} patient(s) affected.`);

  for (const patient of affectedPatients) {
    const secondaryId = patient.secondary_clinician;
    if (!secondaryId) {
      trackEvent('reassignment.no_secondary', { patient_id: patient.id });
      console.warn(`[Reassignment] Patient ${patient.id} has no secondary clinician — needs manual intervention`);
      continue;
    }

    const secondary = await getClinician(secondaryId);
    if (!secondary || secondary.status === 'called_off') {
      trackEvent('reassignment.secondary_unavailable', { patient_id: patient.id });
      console.warn(`[Reassignment] Secondary clinician ${secondaryId} unavailable for patient ${patient.id}`);
      continue;
    }

    // Promote secondary to primary and clear the secondary slot
    // The called-off clinician stays in the system (status: called_off) but is no longer assigned
    const now = new Date();
    await updateEntityField('patient', patient.id, 'primary_clinician', secondaryId);
    await updateEntityField('patient', patient.id, 'secondary_clinician', null);
    await mergeField('patient', patient.id, 'primary_clinician', now, 'system');
    await mergeField('patient', patient.id, 'secondary_clinician', now, 'system');

    const reassignmentEvent: SyncEvent = {
      eventId: uuidv4(),
      source: originalEvent.source,
      entityType: 'patient',
      entityId: patient.id,
      fields: [
        { fieldName: 'primary_clinician', oldValue: clinicianId, newValue: secondaryId },
        { fieldName: 'secondary_clinician', oldValue: secondaryId, newValue: null },
      ],
      timestamp: now.toISOString(),
      actorRole: 'admin',
      correlationId: originalEvent.correlationId,
    };

    // Audit the reassignment
    for (const field of reassignmentEvent.fields) {
      await insertAuditLog(
        reassignmentEvent.eventId, 'patient', patient.id, field,
        'hr', now.toISOString(), 'applied', 'admin',
        `Auto-reassignment: ${secondary.employee_name} promoted from secondary to primary due to ${calledOffClinician?.employee_name ?? 'clinician'} call-off`,
      );
    }

    // Emit the reassignment result
    const reassignmentResult: SyncResult = {
      eventId: reassignmentEvent.eventId,
      entityType: 'patient',
      entityId: patient.id,
      fieldResults: [
        { fieldName: 'primary_clinician', outcome: 'applied', appliedValue: secondaryId },
        { fieldName: 'secondary_clinician', outcome: 'applied', appliedValue: null },
      ],
      timestamp: now.toISOString(),
    };

    await emitDownstream(reassignmentEvent, reassignmentResult);
    await emitToSocketIO(reassignmentEvent, reassignmentResult);

    trackEvent('reassignment.completed', { patient_id: patient.id, new_primary: secondaryId });
    console.log(`[Reassignment] Patient ${patient.patient_name}: ${secondary.employee_name} promoted to primary`);
  }
}

export async function emitDownstream(event: SyncEvent, result: SyncResult): Promise<void> {
  const appliedFields = result.fieldResults.filter((f) => f.outcome === 'applied');
  if (appliedFields.length === 0) return;

  // Emit to all outbound topics except the source
  const targets = Object.entries(SOURCE_TO_OUTBOUND).filter(([src]) => src !== event.source);

  for (const [, topic] of targets) {
    try {
      await produce(topic, event.entityId, result);
    } catch (err) {
      reportError(err as Error, { topic, event_id: event.eventId });
      await sendToDLQ(topic, event, err as Error);
    }
  }

  // Emit to audit topic
  try {
    await produce(TOPICS.AUDIT, event.entityId, { event, result });
  } catch (err) {
    reportError(err as Error, { topic: TOPICS.AUDIT, event_id: event.eventId });
  }
}

export async function emitToSocketIO(event: SyncEvent, result: SyncResult): Promise<void> {
  const updatedEntity = await getEntity(event.entityType, event.entityId);

  for (const socket of await io.fetchSockets()) {
    const role = socket.data.role || 'readonly';
    const source = socket.data.source;

    const accessControl = buildAccessControl(role, event.entityType);
    const filteredEntity = updatedEntity
      ? filterFieldsForRole(role, event.entityType, updatedEntity as Record<string, unknown>)
      : undefined;

    const envelope: EventEnvelope = {
      event: result,
      accessControl,
      entityData: filteredEntity as Record<string, unknown> | undefined,
    };

    const hasErrors = result.fieldResults.some((f) => f.outcome !== 'applied');

    // Send update to all clients
    socket.emit('sync:update', envelope);

    // Send error events specifically to the source system's clients
    if (hasErrors && source === event.source) {
      socket.emit('sync:error', envelope);
    }
  }
}
