import { SophosHttpClient } from './http-client.js';

export interface SophosFirewallUpgradeResult {
  id?: string;
  upgradeToVersion?: string[];
}

export interface SophosTenant {
  id: string;
  name: string;
  apiHost?: string;
  status?: string;
  dataGeography?: string;
}

export class SophosConnector {
  private client: SophosHttpClient;

  readonly endpoint: {
    list: (apiHost: string, tenantId?: string) => Promise<unknown[]>;
  };

  readonly firewall: {
    list: (apiHost: string, tenantId?: string) => Promise<unknown[]>;
    firmwareUpgradeCheck: (
      apiHost: string,
      tenantId: string,
      firewallIds: string[]
    ) => Promise<SophosFirewallUpgradeResult[]>;
  };

  readonly license: {
    list: (tenantId?: string) => Promise<unknown[]>;
  };

  readonly partner: {
    tenants: {
      list: () => Promise<SophosTenant[]>;
    };
  };

  constructor(clientId: string, clientSecret: string) {
    this.client = new SophosHttpClient(clientId, clientSecret);

    this.endpoint = {
      list: (apiHost, tenantId) =>
        this.client.fetchAllPages(
          `${apiHost}/endpoint/v1/endpoints?pageSize=500&pageTotal=true`,
          tenantId
        )
    };

    this.firewall = {
      list: (apiHost, tenantId) =>
        this.client.fetchAllPages(
          `${apiHost}/firewall/v1/firewalls?pageTotal=true&pageSize=100`,
          tenantId
        ),

      firmwareUpgradeCheck: async (apiHost, tenantId, firewallIds) => {
        const result = await this.client.post<{
          firewalls?: SophosFirewallUpgradeResult[];
        }>(
          `${apiHost}/firewall/v1/firewalls/actions/firmware-upgrade-check`,
          { firewalls: firewallIds },
          tenantId
        );
        return result.firewalls ?? [];
      }
    };

    this.license = {
      list: async (tenantId) => {
        const result = await this.client.get<{ licenses?: unknown[] }>(
          'https://api.central.sophos.com/licenses/v1/licenses',
          tenantId
        );
        return result.licenses ?? [];
      }
    };

    this.partner = {
      tenants: {
        list: () => this.fetchPartnerTenants()
      }
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.getToken();
      return true;
    } catch {
      return false;
    }
  }

  private async fetchPartnerTenants(): Promise<SophosTenant[]> {
    const whoami = await this.client.get<{
      id: string;
      idType: string;
      apiHosts?: { global?: string };
    }>('https://api.central.sophos.com/whoami/v1');

    if (whoami.idType !== 'partner' || !whoami.id) return [];

    const globalHost = whoami.apiHosts?.global ?? 'https://api.central.sophos.com';
    const tenants = await this.client.fetchAllPages<SophosTenant>(
      `${globalHost}/partner/v1/tenants?pageTotal=true&pageSize=100`,
      undefined,
      { partnerId: whoami.id }
    );
    tenants.sort((a, b) => a.name.localeCompare(b.name));
    return tenants;
  }
}
