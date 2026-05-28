<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { cn } from '$lib/utils';

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
  import { goto } from '$app/navigation';
  import type { createTrpcClient } from '$lib/trpc';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  const NOW = Date.now();

  // ── Global overview ──────────────────────────────────────────────────────
  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'cove', 'active'],
    queryFn: () => trpc.integrationLinks.list.query({ integrationId: 'cove', status: 'active' }),
    enabled: !scopeStore.currentSite,
  }));

  // ── Per-site: find the link for this site ────────────────────────────────
  const siteLinkQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'cove', scopeStore.currentSite],
    queryFn: () =>
      trpc.integrationLinks.list.query({
        integrationId: 'cove',
        siteId: scopeStore.currentSite!,
      }),
    enabled: !!scopeStore.currentSite,
  }));

  const currentLink = $derived(siteLinkQuery.data?.[0]?.id ?? null);

  // ── Per-link: endpoint overview data ────────────────────────────────────
  const endpointsQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'cove_endpoints', currentLink],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'cove_endpoints',
        linkId: currentLink!,
        page: 1,
        pageSize: 1000,
      }),
    enabled: !!currentLink && !!scopeStore.currentSite,
  }));

  const alertsQuery = createQuery(() => ({
    queryKey: ['alerts.tableData', 'cove', currentLink],
    queryFn: () =>
      trpc.alerts.tableData.query({
        linkId: currentLink ?? undefined,
        integrationId: 'cove',
        page: 0,
        pageSize: 1000,
        filters: [{ field: 'status', operator: 'eq', value: 'active' }],
        sortField: 'severity',
        sortDir: 'desc',
      }),
    enabled: !!currentLink,
  }));

  type EndpointRow = Record<string, unknown>;

  const endpointStats = $derived.by(() => {
    const eps = (endpointsQuery.data?.rows ?? []) as EndpointRow[];
    const failed = eps.filter((e) => e['status'] === 'error').length;
    const noRecentBackup = eps.filter(
      (e) => !e['lastSuccessAt'] || NOW - new Date(String(e['lastSuccessAt'])).getTime() > 7 * 86_400_000,
    ).length;
    const totalSelectedSize = eps.reduce((sum, e) => sum + Number(e['selectedSize'] ?? 0), 0);
    const totalUsedStorage = eps.reduce((sum, e) => sum + Number(e['usedStorage'] ?? 0), 0);
    return { total: eps.length, failed, noRecentBackup, totalSelectedSize, totalUsedStorage };
  });

  const statusDistribution = $derived.by(() => {
    const eps = (endpointsQuery.data?.rows ?? []) as EndpointRow[];
    const counts = new Map<string, number>();
    for (const endpoint of eps) {
      const status = String(endpoint['status'] ?? 'unknown');
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        status,
        count,
        pct: eps.length ? Math.round((count / eps.length) * 100) : 0,
      }));
  });

  const alertStats = $derived.by(() => {
    const rows = alertsQuery.data?.rows ?? [];
    return {
      total: alertsQuery.data?.total ?? rows.length,
      critical: rows.filter((alert) => alert.severity >= 3).length,
      high: rows.filter((alert) => alert.severity === 2).length,
    };
  });

  // ── Global overview helpers ───────────────────────────────────────────────
  const links = $derived(linksQuery.data ?? []);

  function statusColor(status: string | null) {
    if (status === 'error') return 'bg-destructive';
    if (status === 'disabled') return 'bg-muted-foreground';
    return 'bg-success';
  }

  function statusLabel(status: string | null) {
    if (status === 'error') return { text: 'Error', cls: 'bg-destructive/15 text-destructive' };
    if (status === 'disabled') return { text: 'Disabled', cls: 'bg-muted text-muted-foreground' };
    return { text: 'Active', cls: 'bg-success/15 text-success' };
  }

  function relativeTime(ts: Date | string | null | undefined) {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function selectSite(link: (typeof links)[number]) {
    if (link.siteId) scopeStore.currentSite = link.siteId;
    goto('/cove');
  }
</script>

{#if scopeStore.currentSite}
  <!-- ── Per-site dashboard ────────────────────────────────────────────── -->
  {#if siteLinkQuery.isLoading}
    <div class="flex items-center justify-center size-full text-sm text-muted-foreground">
      Loading…
    </div>
  {:else if !currentLink}
    <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
      <div class="text-sm font-medium">No Cove integration for this site.</div>
    </div>
  {:else}
    <div class="flex flex-col size-full overflow-y-auto p-4 gap-4">
      <!-- KPI strip -->
      <div class="grid grid-cols-4 gap-3">
        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Active Alerts
          </div>
          <div
            class="text-3xl font-bold tabular-nums {alertStats.total > 0 ? 'text-destructive' : ''}"
          >
            {alertsQuery.isLoading ? '—' : alertStats.total}
          </div>
          <div class="text-xs text-muted-foreground">
            {alertStats.critical} critical, {alertStats.high} high
          </div>
        </div>
        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Total Endpoints
          </div>
          <div class="text-3xl font-bold tabular-nums">
            {endpointsQuery.isLoading ? '—' : endpointStats.total}
          </div>
        </div>
        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Backup Failed
          </div>
          <div
            class="text-3xl font-bold tabular-nums {endpointStats.failed > 0
              ? 'text-destructive'
              : ''}"
          >
            {endpointsQuery.isLoading ? '—' : endpointStats.failed}
          </div>
          <div class="text-xs text-muted-foreground">most recent backup</div>
        </div>
        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            No Recent (7d)
          </div>
          <div
            class="text-3xl font-bold tabular-nums {endpointStats.noRecentBackup > 0
              ? 'text-warning'
              : ''}"
          >
            {endpointsQuery.isLoading ? '—' : endpointStats.noRecentBackup}
          </div>
          <div class="text-xs text-muted-foreground">no success this week</div>
        </div>
      </div>

      <div class="grid grid-cols-[1fr_1fr] gap-3">
        <div class="rounded-lg border bg-card p-4">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Endpoint Status
          </div>
          {#if endpointsQuery.isLoading}
            <div class="h-24 bg-muted rounded animate-pulse"></div>
          {:else}
            <div class="flex flex-col gap-2">
              {#each statusDistribution as item}
                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-muted-foreground capitalize">{item.status}</span>
                    <span>{item.count}</span>
                  </div>
                  <div class="w-full h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      class="{item.status === 'active'
                        ? 'bg-success'
                        : item.status === 'inactive'
                          ? 'bg-muted-foreground/40'
                          : 'bg-destructive'} h-full rounded-full"
                      style="width:{item.pct}%;transition:width 0.4s"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Protected Storage
          </div>
          <div class="text-3xl font-bold tabular-nums text-primary">
            {endpointsQuery.isLoading ? '—' : formatBytes(endpointStats.totalUsedStorage)}
          </div>
          <div class="text-xs text-muted-foreground">
            {endpointsQuery.isLoading ? '—' : formatBytes(endpointStats.totalSelectedSize)} selected
          </div>
        </div>
      </div>

      <!-- Quick links -->
      <div class="flex flex-wrap gap-2">
        <a
          href="/cove/endpoints"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >
          Endpoints →
        </a>
        <a
          href="/cove/alerts"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >
          Alerts →
        </a>
      </div>
    </div>
  {/if}
{:else}
  <!-- ── Global sites overview ──────────────────────────────────────────── -->
  <div class="flex flex-col size-full overflow-hidden">
    <div class="grid grid-cols-4 gap-3 p-4 border-b shrink-0">
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Total Sites
        </div>
        <div class="text-3xl font-bold tabular-nums">
          {linksQuery.isLoading ? '—' : links.length}
        </div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Active
        </div>
        <div class="text-3xl font-bold tabular-nums text-success">
          {linksQuery.isLoading ? '—' : links.filter((l) => l.status === 'active').length}
        </div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Errors
        </div>
        <div class="text-3xl font-bold tabular-nums text-destructive">
          {linksQuery.isLoading ? '—' : links.filter((l) => l.status === 'error').length}
        </div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Disabled
        </div>
        <div class="text-3xl font-bold tabular-nums text-muted-foreground">
          {linksQuery.isLoading ? '—' : links.filter((l) => l.status === 'disabled').length}
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      {#if linksQuery.isLoading}
        <div class="flex items-center justify-center h-32 text-sm text-muted-foreground">
          Loading…
        </div>
      {:else if links.length === 0}
        <div class="flex flex-col items-center gap-2 text-muted-foreground pt-12">
          <div class="text-sm">No Cove sites connected.</div>
          <a href="/setup/integrations" class="text-xs text-primary hover:underline">
            Configure integration →
          </a>
        </div>
      {:else}
        <div class="flex flex-col gap-1">
          {#each links as link}
            {@const s = statusLabel(link.status)}
            <button
              onclick={() => selectSite(link)}
              class="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left w-full"
            >
              <span
                class={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', statusColor(link.status))}
              ></span>
              <span class="font-medium text-sm flex-1">{link.name ?? link.externalId ?? link.id}</span>
              <span class="text-xs text-muted-foreground">{relativeTime(link.updatedAt)}</span>
              <span
                class={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  s.cls,
                )}
              >
                {s.text}
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
