import type { M365Connector } from './connector.js';

const CAPABILITY_PLANS: Record<string, string[]> = {
  signInActivity: ['AAD_PREMIUM', 'AAD_PREMIUM_P2'],
  conditionalAccess: ['AAD_PREMIUM', 'AAD_PREMIUM_P2'],
  identityProtection: ['AAD_PREMIUM_P2'],
};

export class TenantCapabilityService {
  constructor(private connector: M365Connector) {}

  async probe(): Promise<Record<string, boolean>> {
    const skus = (await this.connector.subscribedSkus.listAll()) as Array<{
      servicePlans: Array<{ servicePlanName: string }>;
    }>;

    const activePlans = new Set<string>(
      skus.flatMap((sku) => sku.servicePlans.map((sp) => sp.servicePlanName))
    );

    return Object.fromEntries(
      Object.entries(CAPABILITY_PLANS).map(([key, plans]) => [
        key,
        plans.some((plan) => activePlans.has(plan)),
      ])
    );
  }
}
