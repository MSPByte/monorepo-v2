<script lang="ts">
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, boolBadgeColumn, nullableTextColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import GroupSheet from './_group-sheet.svelte';

  type GroupRow = {
    id: string;
    name: string;
    description: string | null;
    mailEnabled: boolean;
    securityEnabled: boolean;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<GroupRow>[] = [
    textColumn<GroupRow>('name', 'Name'),
    boolBadgeColumn<GroupRow>('mailEnabled', 'Mail-enabled', {
      trueLabel: 'Yes',
      falseLabel: 'No',
      falseVariant: 'muted',
    }),
    boolBadgeColumn<GroupRow>('securityEnabled', 'Security', {
      trueLabel: 'Yes',
      falseLabel: 'No',
      falseVariant: 'muted',
    }),
    nullableTextColumn<GroupRow>('description', 'Description'),
  ];

  let selectedGroup = $state<GroupRow | null>(null);
</script>

{#if !scopeStore.currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a tenant to view groups</div>
    <div class="text-xs">Use the tenant selector in the navigation bar</div>
  </div>
{:else}
  <VendorDataTable
    table="m365_groups"
    linkId={scopeStore.currentLink}
    {columns}
    onrowclick={(row) => (selectedGroup = row as GroupRow)}
  />
{/if}

<GroupSheet
  group={selectedGroup}
  linkId={scopeStore.currentLink ?? ''}
  onclose={() => (selectedGroup = null)}
/>
