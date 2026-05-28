import { AlertSeverity } from '../../types/alerts.js';
import type { AlertDefinition } from '../../types/alerts.js';

export const COVE_ALERT_DEFINITIONS: Record<string, AlertDefinition> = {
  'cove.endpoint.errors': {
    id: 'cove.endpoint.errors',
    integrationId: 'cove',
    name: 'Cove Endpoint Errors',
    tag: 'Errors',
    description: 'Endpoint has one or more Cove backup errors.',
    messageTemplate: '{{endpointName}} has {{errors}} backup errors.',
    severity: AlertSeverity.Medium
  },
  'cove.endpoint.lastSuccessStale': {
    id: 'cove.endpoint.lastSuccessStale',
    integrationId: 'cove',
    name: 'Cove Last Successful Backup Stale',
    tag: 'Stale Backup',
    description: 'Endpoint has not had a successful backup in more than 48 hours.',
    messageTemplate: '{{endpointName}} has not had a successful backup in more than 48 hours.',
    severity: AlertSeverity.High
  }
};
