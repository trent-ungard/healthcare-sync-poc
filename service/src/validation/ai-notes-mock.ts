import type { FieldUpdate, NotesValidationResult } from '../../../shared/src/types';

export async function validateAgainstNotes(
  _entityType: string,
  notes: string,
  update: FieldUpdate,
): Promise<NotesValidationResult> {
  const notesLower = notes.toLowerCase();
  const fieldName = update.fieldName;
  const newValue = String(update.newValue ?? '').toLowerCase();

  // Shift preference check
  if (fieldName === 'shift') {
    if (
      (notesLower.includes('prefers morning') || notesLower.includes('morning shift')) &&
      newValue === 'nights'
    ) {
      return {
        allow: false,
        reason: 'Notes indicate this person prefers morning shifts. Assigning to Nights conflicts with documented preference.',
        confidence: 0.85,
      };
    }
    if (notesLower.includes('no weekends') || notesLower.includes('does not want to work weekends')) {
      return {
        allow: true,
        reason: 'Notes mention weekend restrictions but shift change does not involve weekends directly. Flagging for awareness.',
        confidence: 0.6,
      };
    }
  }

  // Gender preference check (patient notes)
  if (fieldName === 'oriented_staff' || fieldName === 'staff_exceptions') {
    if (notesLower.includes('no male nurses') || notesLower.includes('prefers female')) {
      return {
        allow: true,
        reason: 'Notes indicate gender preference for caregivers. Verify that assigned staff meets patient preference.',
        confidence: 0.75,
      };
    }
  }

  // Certification removal check
  if (fieldName === 'certifications') {
    const oldCerts = Array.isArray(update.oldValue) ? update.oldValue.map((c: string) => c.toLowerCase()) : [];
    const newCerts = Array.isArray(update.newValue) ? update.newValue.map((c: string) => c.toLowerCase()) : [];
    const removed = oldCerts.filter((c: string) => !newCerts.includes(c));

    for (const cert of removed) {
      if (notesLower.includes(`experienced with ${cert}`) || notesLower.includes(cert)) {
        return {
          allow: true,
          reason: `Notes reference experience with "${cert}" but certification is being removed. This may indicate an expired certification. Flagging for review.`,
          confidence: 0.7,
        };
      }
    }
  }

  // Care schedule disruption check (patient)
  if (fieldName === 'specialty_requirements') {
    if (notesLower.includes('agitated if routine is disrupted') || notesLower.includes('strictly')) {
      return {
        allow: true,
        reason: 'Notes indicate patient is sensitive to routine changes. Ensure this specialty requirement change does not disrupt established care schedule.',
        confidence: 0.65,
      };
    }
  }

  // Hard of hearing note (patient phone changes)
  if (fieldName === 'phone_number' && notesLower.includes('hard of hearing')) {
    return {
      allow: true,
      reason: 'Notes indicate patient is hard of hearing. Phone contact may require alternative communication methods.',
      confidence: 0.5,
    };
  }

  return { allow: true, reason: 'No conflicts detected in notes.', confidence: 0.9 };
}
