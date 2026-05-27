<script lang="ts">
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, nullableTextColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import OAuthGrantSheet from './_oauth-grant-sheet.svelte';

  type OAuthGrantRow = {
    id: string;
    clientId: string;
    clientDisplayName: string | null;
    consentType: string;
    principalId: string | null;
    resourceId: string;
    resourceDisplayName: string | null;
    scope: string | null;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<OAuthGrantRow>[] = [
    nullableTextColumn<OAuthGrantRow>('clientDisplayName', 'Application'),
    {
      key: 'consentType',
      title: 'Consent Type',
      sortable: true,
      filter: {
        type: 'select',
        operators: ['eq', 'neq'],
        options: [
          { label: 'Admin (All Principals)', value: 'AllPrincipals' },
          { label: 'User (Principal)', value: 'Principal' },
        ],
      },
    },
    nullableTextColumn<OAuthGrantRow>('resourceDisplayName', 'Resource'),
    nullableTextColumn<OAuthGrantRow>('scope', 'Scopes'),
    textColumn<OAuthGrantRow>('clientId', 'Client ID', undefined, { defaultHidden: true }),
  ];

  let selectedGrant = $state<OAuthGrantRow | null>(null);
</script>

{#if !scopeStore.currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a tenant to view OAuth grants</div>
    <div class="text-xs">Use the tenant selector in the navigation bar</div>
  </div>
{:else}
  <VendorDataTable
    table="m365_oauth_grants"
    linkId={scopeStore.currentLink}
    {columns}
    onrowclick={(row) => (selectedGrant = row as OAuthGrantRow)}
  />
{/if}

<OAuthGrantSheet
  grant={selectedGrant}
  onclose={() => (selectedGrant = null)}
/>
