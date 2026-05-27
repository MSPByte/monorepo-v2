import { describe, it, expect } from 'vitest';
import { ProviderFacet } from '@mspbyte/shared';
import { m365Adapter, getM365FacetSchema, type M365User, type M365Group } from './index.js';

const validUser: M365User = {
  id: 'aaa-111',
  displayName: 'Alice Smith',
  userPrincipalName: 'alice@example.com',
  accountEnabled: true,
  strongAuthenticationRequirements: [{ rememberDevicesNotIssuedBefore: '2024-01-01' }],
};

const userWithoutMfa: M365User = {
  id: 'bbb-222',
  displayName: 'Bob Jones',
  userPrincipalName: 'bob@example.com',
  accountEnabled: true,
  strongAuthenticationRequirements: [],
};

const validGroup: M365Group = {
  id: 'grp-001',
  displayName: 'Engineering',
  mailEnabled: false,
  securityEnabled: true,
};

describe('m365Adapter.normalize identities', () => {
  it('normalizes user to correct camelCase shape', () => {
    const normalized = m365Adapter.normalize(validUser, ProviderFacet.M365Identities) as Record<string, unknown>;
    expect(normalized.externalId).toBe('aaa-111');
    expect(normalized.email).toBe('alice@example.com');
    expect(normalized.name).toBe('Alice Smith');
    expect(normalized.enabled).toBe(true);
    // mfaEnforced is always false on identities facet — updated by auth_methods facet
    expect(normalized.mfaEnforced).toBe(false);
  });

  it('maps user without MFA to mfaEnforced: false', () => {
    const normalized = m365Adapter.normalize(userWithoutMfa, ProviderFacet.M365Identities) as Record<string, unknown>;
    expect(normalized.mfaEnforced).toBe(false);
  });

  it('handles missing optional fields gracefully', () => {
    const minimal: M365User = {
      id: 'ccc-333',
      userPrincipalName: 'min@example.com',
    };
    const normalized = m365Adapter.normalize(minimal, ProviderFacet.M365Identities) as Record<string, unknown>;
    // displayName falls back to userPrincipalName when absent
    expect(normalized.name).toBe('min@example.com');
    expect(normalized.mfaEnforced).toBe(false);
    expect(normalized.enabled).toBe(true);
  });
});

describe('m365Adapter.normalize groups', () => {
  it('maps group to correct camelCase shape', () => {
    const normalized = m365Adapter.normalize(validGroup, ProviderFacet.M365Groups) as Record<string, unknown>;
    expect(normalized.externalId).toBe('grp-001');
    expect(normalized.name).toBe('Engineering');
    expect(normalized.mailEnabled).toBe(false);
    expect(normalized.securityEnabled).toBe(true);
  });
});

describe('getM365FacetSchema', () => {
  it('parses a valid user object without error', () => {
    const schema = getM365FacetSchema(ProviderFacet.M365Identities);
    expect(() => schema.parse(validUser)).not.toThrow();
  });

  it('fails to parse user missing required id field', () => {
    const schema = getM365FacetSchema(ProviderFacet.M365Identities);
    const bad = { displayName: 'No ID', userPrincipalName: 'noid@example.com' };
    expect(() => schema.parse(bad)).toThrow();
  });

  it('returns a schema for all supported facets', () => {
    const supported = [
      ProviderFacet.M365Identities, ProviderFacet.M365Groups, ProviderFacet.M365Licenses,
      ProviderFacet.M365CAPolicies, ProviderFacet.M365AuthMethods, ProviderFacet.M365Devices,
      ProviderFacet.M365OAuthGrants, ProviderFacet.M365RiskyUsers,
    ];
    for (const facet of supported) {
      expect(() => getM365FacetSchema(facet)).not.toThrow();
    }
  });
});
