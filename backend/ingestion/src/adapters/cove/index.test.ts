import { describe, expect, it } from 'vitest';
import { ProviderFacet } from '@mspbyte/shared';
import { coveAdapter, getCoveFacetSchema } from './index.js';

describe('getCoveFacetSchema', () => {
  it('coerces Cove setting values before normalization', () => {
    const schema = getCoveFacetSchema(ProviderFacet.CoveEndpoints);

    const parsed = schema.parse({
      AccountId: 123,
      PartnerId: 456,
      Flags: null,
      Settings: {
        deviceName: 'DESKTOP-01',
        computerName: 'desktop-01',
        deviceType: 1,
        backupStatus: 5,
        errors: 0,
        selectedSize: 123.45,
        usedStorage: 67.89,
        last28Days: null,
        lastSuccessfulSession: 1717000000
      }
    });

    const normalized = coveAdapter.normalize(parsed, ProviderFacet.CoveEndpoints) as Record<
      string,
      unknown
    >;

    expect(normalized.externalId).toBe('123');
    expect(normalized.endpointName).toBe('DESKTOP-01');
    expect(normalized.type).toBe('workstation');
    expect(normalized.status).toBe('active');
    expect(normalized.errors).toBe(0);
    expect(normalized.selectedSize).toBe(123);
    expect(normalized.usedStorage).toBe(68);
    expect(normalized.last28Days).toBe('');
    expect(normalized.lastSuccessAt).toBeInstanceOf(Date);
  });
});
