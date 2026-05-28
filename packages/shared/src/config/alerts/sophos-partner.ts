import { AlertSeverity } from '../../types/alerts.js';
import type { AlertDefinition } from '../../types/alerts.js';

export const SOPHOS_ALERT_DEFINITIONS: Record<string, AlertDefinition> = {
  'sophos.endpoint.tamper_protection': {
    id: 'sophos.endpoint.tamper_protection',
    integrationId: 'sophos-partner',
    name: 'Sophos Tamper Protection Disabled',
    tag: 'Tamper',
    description: 'Endpoint has Sophos tamper protection disabled.',
    messageTemplate: '{{hostname}} has tamper protection disabled.',
    severity: AlertSeverity.Medium
  }
};
