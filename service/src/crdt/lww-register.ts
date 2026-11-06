import { pool } from '../db/pool';

export interface MergeResult {
  applied: boolean;
  reason?: string;
  existingTimestamp?: string;
  existingSource?: string;
}

export async function mergeField(
  entityType: string,
  entityId: string,
  fieldName: string,
  newTimestamp: Date,
  sourceSystem: string,
): Promise<MergeResult> {
  const result = await pool.query(
    `INSERT INTO field_timestamps (entity_type, entity_id, field_name, updated_at, source_system)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entity_type, entity_id, field_name)
     DO UPDATE SET updated_at = EXCLUDED.updated_at, source_system = EXCLUDED.source_system
     WHERE field_timestamps.updated_at < EXCLUDED.updated_at
     RETURNING *`,
    [entityType, entityId, fieldName, newTimestamp, sourceSystem],
  );

  if (result.rowCount === 0) {
    const existing = await pool.query(
      'SELECT updated_at, source_system FROM field_timestamps WHERE entity_type = $1 AND entity_id = $2 AND field_name = $3',
      [entityType, entityId, fieldName],
    );
    return {
      applied: false,
      reason: `Conflict: field "${fieldName}" was last written by ${existing.rows[0]?.source_system} at ${existing.rows[0]?.updated_at}. Incoming timestamp ${newTimestamp.toISOString()} is older.`,
      existingTimestamp: existing.rows[0]?.updated_at,
      existingSource: existing.rows[0]?.source_system,
    };
  }

  return { applied: true };
}
