<script lang="ts">
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, nullableTextColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import PolicySheet from './_policy-sheet.svelte';

  type PolicyConditions = {
    users?: {
      includeUsers?: string[];
      excludeUsers?: string[];
      includeGroups?: string[];
      excludeGroups?: string[];
      includeRoles?: string[];
      excludeRoles?: string[];
    };
    applications?: {
      includeApplications?: string[];
      excludeApplications?: string[];
      includeUserActions?: string[];
    };
    clientAppTypes?: string[];
    userRiskLevels?: string[];
    signInRiskLevels?: string[];
    platforms?: {
      includePlatforms?: string[];
      excludePlatforms?: string[];
    };
    locations?: {
      includeLocations?: string[];
      excludeLocations?: string[];
    };
  };

  type PolicyGrantControls = {
    operator?: string;
    builtInControls?: string[];
  };

  type PolicySessionControls = {
    signInFrequency?: {
      isEnabled?: boolean;
      value?: number;
      type?: string;
      frequencyInterval?: string;
    };
    persistentBrowser?: {
      isEnabled?: boolean;
      mode?: string;
    };
  };

  type PolicyRow = {
    id: string;
    name: string;
    description: string | null;
    policyState: string;
    conditions: PolicyConditions | null;
    grantControls: PolicyGrantControls | null;
    sessionControls: PolicySessionControls | null;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<PolicyRow>[] = [
    textColumn<PolicyRow>('name', 'Policy Name'),
    {
      key: 'policyState',
      title: 'State',
      sortable: true,
      filter: {
        type: 'select',
        operators: ['eq', 'neq'],
        options: [
          { label: 'Enabled', value: 'enabled' },
          { label: 'Report Only', value: 'enabledForReportingButNotEnforced' },
          { label: 'Disabled', value: 'disabled' },
        ],
      },
    },
    nullableTextColumn<PolicyRow>('description', 'Description'),
  ];

  let selectedPolicy = $state<PolicyRow | null>(null);
</script>

<VendorDataTable
  table="m365_policies"
  linkId={scopeStore.currentLink || undefined}
  integrationId="microsoft-365"
  {columns}
  onrowclick={(row) => (selectedPolicy = row as PolicyRow)}
/>

<PolicySheet
  policy={selectedPolicy}
  linkId={scopeStore.currentLink || String(selectedPolicy?.linkId ?? '')}
  onclose={() => (selectedPolicy = null)}
/>
