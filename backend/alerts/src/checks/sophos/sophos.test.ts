import { describe, expect, it, vi } from 'vitest';
import type { CheckInput } from '../interface.js';
import { sophosStaleEndpointCheck } from './stale-endpoint.js';
import { sophosStaleFirewallCheck } from './stale-firewall.js';
import { sophosEndpointNeedsUpdateCheck } from './update-endpoint.js';
import { sophosFirewallNeedsUpdateCheck } from './update-firewall.js';

function makeDb(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows)
      })
    })
  } as unknown as CheckInput['db'];
}

function endpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'endpoint-id',
    linkId: 'link-id',
    siteId: 'site-id',
    externalId: 'endpoint-1',
    hostname: 'workstation-01',
    type: 'computer',
    platform: 'windows',
    osName: 'Windows 11',
    health: 'good',
    online: false,
    needsUpgrade: true,
    hasMdr: false,
    tamperProtectionEnabled: true,
    lockdown: '',
    currentCode: '2026.1',
    previousCodes: [],
    lastHeartbeatAt: null,
    lastSeenAt: '2026-03-01T00:00:00.000Z',
    ...overrides
  };
}

function firewall(overrides: Record<string, unknown> = {}) {
  return {
    id: 'firewall-id',
    linkId: 'link-id',
    siteId: 'site-id',
    externalId: 'firewall-1',
    name: 'HQ Firewall',
    hostname: 'fw-hq',
    model: 'XGS 2100',
    serialNumber: 'SERIAL1',
    firmwareVersion: '20.0',
    externalIp: '203.0.113.10',
    connected: false,
    suspended: false,
    managing: 'central',
    reporting: 'central',
    upgradeToVersion: '20.1',
    lastChangeAt: '2026-03-01T00:00:00.000Z',
    lastSeenAt: '2026-04-01T00:00:00.000Z',
    ...overrides
  };
}

describe('Sophos checks', () => {
  it('emits stale endpoint detections with a 60 day threshold', async () => {
    const results = await sophosStaleEndpointCheck.evaluate({
      linkId: 'link-id',
      db: makeDb([endpoint()])
    });

    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('sophos_stale_endpoint');
    expect(results[0].definitionId).toBe('sophos.endpoint.stale');
    expect(results[0].detail.staleDays).toBe(60);
    expect(results[0].entityRef).toBe('workstation-01');
  });

  it('emits stale firewall detections with a 30 day threshold', async () => {
    const results = await sophosStaleFirewallCheck.evaluate({
      linkId: 'link-id',
      db: makeDb([firewall()])
    });

    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('sophos_stale_firewall');
    expect(results[0].definitionId).toBe('sophos.firewall.stale');
    expect(results[0].detail.staleDays).toBe(30);
    expect(results[0].entityRef).toBe('fw-hq');
  });

  it('emits endpoint update detections', async () => {
    const results = await sophosEndpointNeedsUpdateCheck.evaluate({
      linkId: 'link-id',
      db: makeDb([endpoint()])
    });

    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('sophos_endpoint_needs_update');
    expect(results[0].definitionId).toBe('sophos.endpoint.needsUpdate');
    expect(results[0].detail.currentCode).toBe('2026.1');
  });

  it('emits firewall update detections', async () => {
    const results = await sophosFirewallNeedsUpdateCheck.evaluate({
      linkId: 'link-id',
      db: makeDb([firewall()])
    });

    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('sophos_firewall_needs_update');
    expect(results[0].definitionId).toBe('sophos.firewall.needsUpdate');
    expect(results[0].detail.upgradeToVersion).toBe('20.1');
  });
});
