import type { ProviderId } from '../constants.js';

export const AlertSeverity = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export interface AlertDefinition {
  id: string;
  integrationId: ProviderId;
  name: string;
  tag: string;
  description: string;
  messageTemplate: string;
  severity: AlertSeverity;
}
