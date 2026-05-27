<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { cn } from '$lib/utils';
  import type { createTrpcClient } from '$lib/trpc';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  type LicenseRow = Record<string, unknown>;

  const NOW = Date.now();

  const SERVER_TIER_MAP: Record<string, string> = {
    'SVRCIXAMTR-STD-MSP': 'MDR',
    SVRCIXAXDR: 'XDR',
    'SVRCLOUDADV-MSP': 'Endpoint',
  };
  const USER_TIER_MAP: Record<string, string> = {
    'CIXAMTR-STD-MSP': 'MDR',
    CIXAXDR: 'XDR',
    'CIXA-MSP': 'Endpoint',
  };

  // ── Resolve the link for this site ──────────────────────────────────────
  const siteLinkQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'sophos-partner', scopeStore.currentSite],
    queryFn: () =>
      trpc.integrationLinks.list.query({
        integrationId: 'sophos-partner',
        siteId: scopeStore.currentSite!,
      }),
    enabled: !!scopeStore.currentSite,
  }));

  const currentLink = $derived(siteLinkQuery.data?.[0]?.id ?? null);

  // Load all licenses for stats (page 1, large size)
  const licensesOverviewQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'sophos_licenses', 'overview', currentLink],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'sophos_licenses',
        tenantId: scopeStore.currentSite!,
        linkId: currentLink!,
        page: 1,
        pageSize: 500,
      }),
    enabled: !!currentLink && !!scopeStore.currentSite,
  }));

  const stats = $derived.by(() => {
    const rows = (licensesOverviewQuery.data?.rows ?? []) as LicenseRow[];
    const active = rows.filter(
      (l) => !l['ends_at'] || new Date(l['ends_at'] as string).getTime() > NOW,
    ).length;
    return { total: rows.length, active, expired: rows.length - active };
  });

  const tierInfo = $derived.by(() => {
    const rows = (licensesOverviewQuery.data?.rows ?? []) as LicenseRow[];
    const active = rows.filter(
      (l) => !l['ends_at'] || new Date(l['ends_at'] as string).getTime() > NOW,
    );
    const codes = new Set(active.map((l) => String(l['code'] ?? '')));
    const serverTier =
      codes.has('SVRCIXAMTR-STD-MSP')
        ? 'MDR'
        : codes.has('SVRCIXAXDR')
          ? 'XDR'
          : codes.has('SVRCLOUDADV-MSP')
            ? 'Endpoint'
            : null;
    const userTier =
      codes.has('CIXAMTR-STD-MSP')
        ? 'MDR'
        : codes.has('CIXAXDR')
          ? 'XDR'
          : codes.has('CIXA-MSP')
            ? 'Endpoint'
            : null;
    return { serverTier, userTier };
  });

  const columns: DataTableColumn<LicenseRow>[] = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'code', title: 'Code', width: '180px', sortable: true },
    { key: 'type', title: 'Type', width: '110px', sortable: true },
    { key: 'perpetual', title: 'Perpetual', width: '90px' },
    { key: 'quantity', title: 'Qty', width: '70px' },
    { key: 'usage_count', title: 'Used', width: '70px' },
    { key: 'starts_at', title: 'Starts', width: '110px', sortable: true },
    { key: 'ends_at', title: 'Ends', width: '110px', sortable: true },
  ];

  function tierBadge(tier: string | null) {
    if (tier === 'MDR') return 'bg-primary/15 text-primary';
    if (tier === 'XDR') return 'bg-warning/20 text-warning';
    if (tier === 'Endpoint') return 'bg-success/15 text-success';
    return 'bg-muted text-muted-foreground';
  }

  function codeCategory(code: string): string | null {
    if (SERVER_TIER_MAP[code]) return `Server · ${SERVER_TIER_MAP[code]}`;
    if (USER_TIER_MAP[code]) return `User · ${USER_TIER_MAP[code]}`;
    return null;
  }
</script>

{#if !scopeStore.currentSite}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a site to view licenses</div>
    <div class="text-xs">Use the site selector in the navigation bar</div>
  </div>
{:else if siteLinkQuery.isLoading}
  <div class="flex items-center justify-center size-full text-sm text-muted-foreground">
    Loading…
  </div>
{:else if !currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">No Sophos Partner integration for this site.</div>
  </div>
{:else}
  <div class="flex flex-col size-full overflow-hidden">
    <!-- Summary strip -->
    <div class="grid grid-cols-4 gap-3 p-4 border-b shrink-0">
      <div class="rounded-lg border bg-card p-3 flex flex-col gap-0.5">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</div>
        <div class="text-2xl font-bold tabular-nums">
          {licensesOverviewQuery.isLoading ? '—' : stats.total}
        </div>
      </div>
      <div class="rounded-lg border bg-card p-3 flex flex-col gap-0.5">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</div>
        <div class="text-2xl font-bold tabular-nums text-success">
          {licensesOverviewQuery.isLoading ? '—' : stats.active}
        </div>
      </div>
      <div class="rounded-lg border bg-card p-3 flex flex-col gap-0.5">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Expired
        </div>
        <div
          class="text-2xl font-bold tabular-nums {stats.expired > 0
            ? 'text-destructive'
            : 'text-muted-foreground'}"
        >
          {licensesOverviewQuery.isLoading ? '—' : stats.expired}
        </div>
      </div>
      <div class="rounded-lg border bg-card p-3 flex flex-col gap-1.5">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          License Tiers
        </div>
        <div class="flex gap-1.5 flex-wrap">
          <div class="flex items-center gap-1 text-xs">
            <span class="text-muted-foreground">Server:</span>
            {#if tierInfo.serverTier}
              <span
                class={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded font-medium',
                  tierBadge(tierInfo.serverTier),
                )}
              >
                {tierInfo.serverTier}
              </span>
            {:else}
              <span class="text-muted-foreground">—</span>
            {/if}
          </div>
          <div class="flex items-center gap-1 text-xs">
            <span class="text-muted-foreground">User:</span>
            {#if tierInfo.userTier}
              <span
                class={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded font-medium',
                  tierBadge(tierInfo.userTier),
                )}
              >
                {tierInfo.userTier}
              </span>
            {:else}
              <span class="text-muted-foreground">—</span>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-hidden p-4 min-h-0">
      <VendorDataTable
        table="sophos_licenses"
        tenantId={scopeStore.currentSite}
        linkId={currentLink}
        {columns}
      />
    </div>
  </div>
{/if}
