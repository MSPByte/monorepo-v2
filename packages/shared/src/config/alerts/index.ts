import type { AlertDefinition } from '../../types/alerts.js';
import { MICROSOFT_365_ALERT_DEFINITIONS } from './microsoft-365.js';
import { SOPHOS_ALERT_DEFINITIONS } from './sophos-partner.js';

export { MICROSOFT_365_ALERT_DEFINITIONS } from './microsoft-365.js';
export { SOPHOS_ALERT_DEFINITIONS } from './sophos-partner.js';

export const ALERT_DEFINITIONS: Record<string, AlertDefinition> = {
  ...MICROSOFT_365_ALERT_DEFINITIONS,
  ...SOPHOS_ALERT_DEFINITIONS
} as const;

export function getAlertDefinition(id: string): AlertDefinition | undefined {
  return ALERT_DEFINITIONS[id];
}

export const hydrateMessageTemplate = (
  template: string,
  entity: Record<string, unknown>
): string => {
  if (template.length === 0 || typeof entity !== 'object') return '';

  let idx = 0;
  let finalValue = template;
  while (true) {
    const nextStart = template.indexOf('{{', idx);
    const nextEnd = template.indexOf('}}', nextStart);
    if (nextStart === -1 || nextEnd === -1) break;

    const key = template.substring(nextStart + 2, nextEnd);
    finalValue = finalValue.replace(`{{${key}}}`, String(entity[key]));
    idx = nextEnd;
  }

  return finalValue;
};
