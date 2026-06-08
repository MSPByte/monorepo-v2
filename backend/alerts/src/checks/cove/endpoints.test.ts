import { describe, expect, it, vi } from 'vitest';
import {
  coveEndpointErrorsCheck,
  coveEndpointLastSuccessStaleCheck
} from './endpoints.js';
import type { CheckInput } from '../interface.js';
import { alertSeverity } from '../severity.js';

function makeDb(endpoints: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(endpoints)
      })
    })
  } as unknown as CheckInput['db'];
}

function endpoint(overrides: Record<string, unknown>) {
  return {
    id: 'endpoint-id',
    linkId: 'link-id',
    siteId: 'site-id',
    externalId: 'device-1',
    endpointName: 'SERVER-01',
    hostname: 'server-01.example.com',
    type: 'server',
    profile: 'Default',
    retentionPolicy: '30 days',
    status: 'active',
    lsvStatus: null,
    errors: 0,
    selectedSize: 1024,
    usedStorage: 512,
    last28Days: 'oooooooooooooooooooooooooooo',
    lastSuccessAt: new Date(),
    ...overrides
  };
}

describe('coveEndpointErrorsCheck', () => {
  it('returns a detection when an endpoint has one or more errors', async () => {
    const db = makeDb([endpoint({ errors: 2 })]);

    const results = await coveEndpointErrorsCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('cove_endpoint_errors');
    expect(results[0].definitionId).toBe('cove.endpoint.errors');
    expect(results[0].entityType).toBe('endpoint');
    expect(results[0].entityRef).toBe('SERVER-01');
    expect(results[0].severity).toBe(alertSeverity('cove.endpoint.errors'));
    expect(results[0].detail.errors).toBe(2);
  });

  it('returns no detections when the query finds no endpoints with errors', async () => {
    const db = makeDb([]);

    const results = await coveEndpointErrorsCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(0);
  });
});

describe('coveEndpointLastSuccessStaleCheck', () => {
  it('returns a detection when the last successful backup is older than 48 hours', async () => {
    const db = makeDb([
      endpoint({ lastSuccessAt: new Date(Date.now() - 49 * 60 * 60 * 1000) })
    ]);

    const results = await coveEndpointLastSuccessStaleCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('cove_endpoint_last_success_stale');
    expect(results[0].definitionId).toBe('cove.endpoint.lastSuccessStale');
    expect(results[0].entityType).toBe('endpoint');
    expect(results[0].severity).toBe(alertSeverity('cove.endpoint.lastSuccessStale'));
    expect(results[0].detail.staleHours).toBe(48);
  });

  it('returns a detection when the endpoint has never had a successful backup', async () => {
    const db = makeDb([endpoint({ lastSuccessAt: null })]);

    const results = await coveEndpointLastSuccessStaleCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(1);
    expect(results[0].detail.lastSuccessAt).toBeNull();
  });

  it('returns no detections when the query finds no stale endpoints', async () => {
    const db = makeDb([]);

    const results = await coveEndpointLastSuccessStaleCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(0);
  });
});
