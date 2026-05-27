<script lang="ts">
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, boolBadgeColumn, nullableTextColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import DomainSheet from './_domain-sheet.svelte';

  type DomainRow = {
    id: string;
    domainName: string;
    spfRecord: string | null;
    spfIsPermissive: boolean | null;
    dmarcRecord: string | null;
    dmarcPolicy: string | null;
    dkimEnabled: boolean | null;
    dkimSelector1Present: boolean | null;
    dkimSelector2Present: boolean | null;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<DomainRow>[] = [
    textColumn<DomainRow>('domainName', 'Domain'),
    nullableTextColumn<DomainRow>('spfRecord', 'SPF Record', { defaultHidden: true }),
    boolBadgeColumn<DomainRow>('spfIsPermissive', 'SPF Permissive', {
      trueLabel: 'Permissive',
      falseLabel: 'Strict',
      falseVariant: 'muted',
    }),
    nullableTextColumn<DomainRow>('dmarcPolicy', 'DMARC Policy'),
    boolBadgeColumn<DomainRow>('dkimEnabled', 'DKIM', {
      trueLabel: 'Enabled',
      falseLabel: 'Disabled',
      falseVariant: 'destructive',
    }),
    boolBadgeColumn<DomainRow>('dkimSelector1Present', 'Selector 1', {
      trueLabel: 'Present',
      falseLabel: 'Missing',
      falseVariant: 'destructive',
    }),
    boolBadgeColumn<DomainRow>('dkimSelector2Present', 'Selector 2', {
      trueLabel: 'Present',
      falseLabel: 'Missing',
      falseVariant: 'destructive',
    }),
  ];

  let selectedDomain = $state<DomainRow | null>(null);
</script>

{#if !scopeStore.currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a tenant to view domain security</div>
    <div class="text-xs">Use the tenant selector in the navigation bar</div>
  </div>
{:else}
  <VendorDataTable
    table="m365_domain_config"
    linkId={scopeStore.currentLink}
    {columns}
    onrowclick={(row) => (selectedDomain = row as DomainRow)}
  />
{/if}

<DomainSheet
  domain={selectedDomain}
  onclose={() => (selectedDomain = null)}
/>
