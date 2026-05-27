<script lang="ts">
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, nullableTextColumn, relativeDateColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import RiskyUserSheet from './_risky-user-sheet.svelte';

  type RiskyUserRow = {
    id: string;
    userPrincipalName: string;
    userDisplayName: string | null;
    riskLevel: string;
    riskState: string;
    riskDetail: string | null;
    riskLastUpdatedAt: string | null;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<RiskyUserRow>[] = [
    textColumn<RiskyUserRow>('userPrincipalName', 'User Principal Name'),
    nullableTextColumn<RiskyUserRow>('userDisplayName', 'Display Name'),
    {
      key: 'riskLevel',
      title: 'Risk Level',
      sortable: true,
      filter: {
        type: 'select',
        operators: ['eq', 'neq'],
        options: [
          { label: 'High', value: 'high' },
          { label: 'Medium', value: 'medium' },
          { label: 'Low', value: 'low' },
          { label: 'None', value: 'none' },
        ],
      },
    },
    {
      key: 'riskState',
      title: 'Risk State',
      sortable: true,
      filter: {
        type: 'select',
        operators: ['eq', 'neq'],
        options: [
          { label: 'At Risk', value: 'atRisk' },
          { label: 'Confirmed Compromised', value: 'confirmedCompromised' },
          { label: 'Remediated', value: 'remediated' },
          { label: 'Confirmed Safe', value: 'confirmedSafe' },
          { label: 'Dismissed', value: 'dismissed' },
        ],
      },
    },
    nullableTextColumn<RiskyUserRow>('riskDetail', 'Risk Detail'),
    relativeDateColumn<RiskyUserRow>('riskLastUpdatedAt', 'Last Updated'),
  ];

  let selectedUser = $state<RiskyUserRow | null>(null);
</script>

{#if !scopeStore.currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a tenant to view security information</div>
    <div class="text-xs">Use the tenant selector in the navigation bar</div>
  </div>
{:else}
  <VendorDataTable
    table="m365_risky_users"
    linkId={scopeStore.currentLink}
    {columns}
    onrowclick={(row) => (selectedUser = row as RiskyUserRow)}
  />
{/if}

<RiskyUserSheet
  user={selectedUser}
  onclose={() => (selectedUser = null)}
/>
