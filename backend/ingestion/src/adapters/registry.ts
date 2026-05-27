import type { ProviderAdapter } from '@mspbyte/shared';
import { m365Adapter } from './m365/index.js';
import { sophosAdapter } from './sophos/index.js';
import { dattoAdapter } from './datto/index.js';
import { coveAdapter } from './cove/index.js';

const registry = new Map<string, ProviderAdapter>();

export function registerAdapter(adapter: ProviderAdapter) {
  registry.set(adapter.providerId, adapter);
}

export function getAdapter(providerId: string): ProviderAdapter {
  const adapter = registry.get(providerId);
  if (!adapter) throw new Error(`No adapter registered for provider: ${providerId}`);
  return adapter;
}

// Register all adapters at module load time
registerAdapter(m365Adapter);
registerAdapter(sophosAdapter);
registerAdapter(dattoAdapter);
registerAdapter(coveAdapter);
