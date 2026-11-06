import { getVisibleFields, getRedactedFields } from '../../../shared/src/permissions';
import { ENTITY_FIELDS } from '../../../shared/src/validation-rules';
import type { Role, EntityType, AccessControl } from '../../../shared/src/types';

export function buildAccessControl(role: Role, entityType: EntityType): AccessControl {
  const allFields = ENTITY_FIELDS[entityType] || [];
  const visible = getVisibleFields(role, entityType);
  const visibleList = visible.has('*') ? allFields : allFields.filter((f) => visible.has(f));
  const redacted = getRedactedFields(role, entityType, allFields);

  return { role, visibleFields: visibleList, redactedFields: redacted };
}
