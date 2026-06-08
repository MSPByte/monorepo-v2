import { getAlertDefinition } from '@mspbyte/shared';

export function alertSeverity(definitionId: string): number {
  const definition = getAlertDefinition(definitionId);
  if (!definition) {
    throw new Error(`Missing alert definition for ${definitionId}`);
  }

  return definition.severity;
}
