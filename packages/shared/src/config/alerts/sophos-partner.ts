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
  },
  'sophos.endpoint.stale': {
    id: 'sophos.endpoint.stale',
    integrationId: 'sophos-partner',
    name: 'Sophos Stale Endpoint',
    tag: 'Stale Endpoint',
    description: 'Endpoint has not been seen in more than 60 days.',
    messageTemplate: '{{hostname}} has not been seen in more than 60 days.',
    severity: AlertSeverity.Low
  },
  'sophos.firewall.stale': {
    id: 'sophos.firewall.stale',
    integrationId: 'sophos-partner',
    name: 'Sophos Stale Firewall',
    tag: 'Stale Firewall',
    description: 'Firewall has not been seen in more than 30 days.',
    messageTemplate: '{{hostname}} has not been seen in more than 30 days.',
    severity: AlertSeverity.Low
  },
  'sophos.endpoint.needsUpdate': {
    id: 'sophos.endpoint.needsUpdate',
    integrationId: 'sophos-partner',
    name: 'Sophos Endpoint Needs Update',
    tag: 'Endpoint Update',
    description: 'Endpoint has a Sophos upgrade available.',
    messageTemplate: '{{hostname}} needs a Sophos endpoint update.',
    severity: AlertSeverity.Low
  },
  'sophos.firewall.needsUpdate': {
    id: 'sophos.firewall.needsUpdate',
    integrationId: 'sophos-partner',
    name: 'Sophos Firewall Needs Update',
    tag: 'Firewall Update',
    description: 'Firewall has a Sophos firmware update available.',
    messageTemplate: '{{hostname}} can be updated from {{firmwareVersion}} to {{upgradeToVersion}}.',
    severity: AlertSeverity.Low
  }
};
