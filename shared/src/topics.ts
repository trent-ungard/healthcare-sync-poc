export const TOPICS = {
  INBOUND_EHR: 'sync.inbound.ehr',
  INBOUND_HR: 'sync.inbound.hr',
  INBOUND_SCHEDULING: 'sync.inbound.scheduling',
  OUTBOUND_EHR: 'sync.outbound.ehr',
  OUTBOUND_HR: 'sync.outbound.hr',
  OUTBOUND_SCHEDULING: 'sync.outbound.scheduling',
  AUDIT: 'sync.events.audit',
  DLQ: 'sync.dlq',
} as const;

export const INBOUND_TOPICS = [
  TOPICS.INBOUND_EHR,
  TOPICS.INBOUND_HR,
  TOPICS.INBOUND_SCHEDULING,
] as const;

export const SOURCE_TO_INBOUND: Record<string, string> = {
  ehr: TOPICS.INBOUND_EHR,
  hr: TOPICS.INBOUND_HR,
  scheduling: TOPICS.INBOUND_SCHEDULING,
};

export const SOURCE_TO_OUTBOUND: Record<string, string> = {
  ehr: TOPICS.OUTBOUND_EHR,
  hr: TOPICS.OUTBOUND_HR,
  scheduling: TOPICS.OUTBOUND_SCHEDULING,
};
