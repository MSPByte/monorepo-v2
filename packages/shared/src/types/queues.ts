export const QUEUES = {
  FETCH: 'fetch',
  NORMALIZE: 'normalize',
  LINK: 'link',
  ENRICH: 'enrich',
  ALERTS: 'alerts',
  COMPLIANCE: 'compliance',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
