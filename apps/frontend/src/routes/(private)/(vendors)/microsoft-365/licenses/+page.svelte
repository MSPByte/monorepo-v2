<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, numberColumn, boolBadgeColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import NeedsAttention from './_needs-attention.svelte';
  import LicenseSheet from './_license-sheet.svelte';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  type LicenseRow = {
    id: string;
    externalId: string;
    friendlyName: string | null;
    skuPartNumber: string;
    totalUnits: number;
    consumedUnits: number;
    warningUnits: number;
    enabled: boolean;
    servicePlanNames: string[] | null;
    [key: string]: unknown;
  };

  const licensesQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'm365_licenses', scopeStore.currentLink, 'all'],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'm365_licenses',
        linkId: scopeStore.currentLink!,
        page: 1,
        pageSize: 1000,
      }),
    enabled: !!scopeStore.currentLink,
  }));

  const licenses = $derived((licensesQuery.data?.rows ?? []) as LicenseRow[]);

  const totalSeats = $derived(licenses.reduce((s, l) => s + (l.totalUnits ?? 0), 0));
  const unusedSeats = $derived(
    licenses.reduce((s, l) => s + Math.max(0, (l.totalUnits ?? 0) - (l.consumedUnits ?? 0)), 0)
  );
  const expiringSoon = $derived(licenses.filter((l) => (l.warningUnits ?? 0) > 0).length);

  type Insight = {
    type: 'Waste' | 'Full' | 'Expiring';
    sku: string;
    detail: string;
    variant: 'destructive' | 'warning';
    license: LicenseRow;
  };

  const insights = $derived.by((): Insight[] => {
    const results: Insight[] = [];
    for (const l of licenses) {
      const unused = (l.totalUnits ?? 0) - (l.consumedUnits ?? 0);
      const pct = (l.totalUnits ?? 0) > 0 ? ((l.consumedUnits ?? 0) / (l.totalUnits ?? 0)) * 100 : 0;
      if (unused > 0 && pct < 70) {
        results.push({
          type: 'Waste',
          sku: l.friendlyName || l.skuPartNumber,
          detail: `${unused} of ${l.totalUnits} seats unassigned`,
          variant: 'destructive',
          license: l,
        });
      } else if (pct > 95) {
        results.push({
          type: 'Full',
          sku: l.friendlyName || l.skuPartNumber,
          detail: `${(l.totalUnits ?? 0) - (l.consumedUnits ?? 0)} seats remaining — consider adding more`,
          variant: 'warning',
          license: l,
        });
      }
      if ((l.warningUnits ?? 0) > 0) {
        results.push({
          type: 'Expiring',
          sku: l.friendlyName || l.skuPartNumber,
          detail: `${l.warningUnits} seats expiring soon`,
          variant: 'warning',
          license: l,
        });
      }
    }
    return results;
  });

  const columns: DataTableColumn<LicenseRow>[] = [
    textColumn<LicenseRow>('friendlyName', 'SKU Name'),
    textColumn<LicenseRow>('skuPartNumber', 'Part Number', undefined, { defaultHidden: true }),
    numberColumn<LicenseRow>('consumedUnits', 'Assigned'),
    numberColumn<LicenseRow>('totalUnits', 'Total'),
    numberColumn<LicenseRow>('warningUnits', 'Expiring'),
    boolBadgeColumn<LicenseRow>('enabled', 'Status', {
      trueLabel: 'Active',
      falseLabel: 'Inactive',
      falseVariant: 'muted',
    }),
  ];

  let viewAll = $state(false);
  let selectedLicense = $state<LicenseRow | null>(null);
</script>

{#if !scopeStore.currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a tenant to view licenses</div>
    <div class="text-xs">Use the tenant selector in the navigation bar</div>
  </div>
{:else if viewAll}
  <!-- All Licenses view -->
  <div class="flex flex-col size-full overflow-hidden">
    <div class="flex items-center gap-3 px-4 py-3 border-b shrink-0">
      <button
        onclick={() => (viewAll = false)}
        class="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Insights
      </button>
    </div>
    <div class="flex-1 overflow-hidden">
      <VendorDataTable
        table="m365_licenses"
        linkId={scopeStore.currentLink}
        {columns}
        onrowclick={(row) => (selectedLicense = row as LicenseRow)}
      />
    </div>
  </div>
{:else}
  <NeedsAttention
    {licenses}
    loading={licensesQuery.isPending}
    {totalSeats}
    {unusedSeats}
    {expiringSoon}
    {insights}
    onviewall={() => (viewAll = true)}
    onrowclick={(lic) => (selectedLicense = lic)}
  />
{/if}

<LicenseSheet
  license={selectedLicense}
  linkId={scopeStore.currentLink ?? ''}
  onclose={() => (selectedLicense = null)}
/>
