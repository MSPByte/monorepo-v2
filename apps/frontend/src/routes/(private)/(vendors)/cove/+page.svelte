<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
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
  import InsightsPanel from './_InsightsPanel.svelte';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');
  const queryClient = useQueryClient();

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
    queryKey: ['alerts.list', 'cove', currentLink, 'active'],
    queryFn: () =>
      trpc.alerts.list.query({
        linkId: currentLink ?? undefined,
        status: 'active',
      }),
    enabled: !!currentLink,
  }));

  function refreshSiteAlerts() {
    queryClient.invalidateQueries({
      queryKey: ['alerts.list', 'cove', currentLink, 'active'],
    });
  }

  type EndpointRow = Record<string, unknown>;

  const endpointStats = $derived.by(() => {
    const eps = (endpointsQuery.data?.rows ?? []) as EndpointRow[];
    const withErrors = eps.filter((e) => Number(e['errors'] ?? 0) > 0).length;
    const staleSuccess = eps.filter(
      (e) => !e['lastSuccessAt'] || NOW - new Date(String(e['lastSuccessAt'])).getTime() > 48 * 3_600_000,
    ).length;
    const totalSelectedSize = eps.reduce((sum, e) => sum + Number(e['selectedSize'] ?? 0), 0);
    const totalUsedStorage = eps.reduce((sum, e) => sum + Number(e['usedStorage'] ?? 0), 0);
    return { total: eps.length, withErrors, staleSuccess, totalSelectedSize, totalUsedStorage };
  });

  const alertStats = $derived.by(() => {
    const rows = alertsQuery.data ?? [];
    return {
      total: rows.length,
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
    <div class="flex flex-col size-full overflow-hidden">
      <div class="flex items-center gap-5 px-4 py-2.5 border-b shrink-0 flex-wrap">
        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-1.5">
            <span
              class={cn(
                'text-lg font-semibold tabular-nums',
                alertStats.total > 0 && 'text-destructive',
              )}
            >
              {alertsQuery.isLoading ? '—' : alertStats.total}
            </span>
            <span class="text-xs text-muted-foreground">Active Alerts</span>
          </div>
          <span class="text-[11px] text-muted-foreground tabular-nums">
            {alertStats.critical} critical, {alertStats.high} high
          </span>
        </div>

        <div class="w-px h-8 bg-border shrink-0"></div>

        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-1.5">
            <span class="text-lg font-semibold tabular-nums">
              {endpointsQuery.isLoading ? '—' : endpointStats.total}
            </span>
            <span class="text-xs text-muted-foreground">Endpoints</span>
          </div>
        </div>

        <div class="w-px h-8 bg-border shrink-0"></div>

        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-1.5">
            <span
              class={cn(
                'text-lg font-semibold tabular-nums',
                endpointStats.withErrors > 0 && 'text-destructive',
              )}
            >
              {endpointsQuery.isLoading ? '—' : endpointStats.withErrors}
            </span>
            <span class="text-xs text-muted-foreground">With Errors</span>
          </div>
        </div>

        <div class="w-px h-8 bg-border shrink-0"></div>

        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-1.5">
            <span
              class={cn(
                'text-lg font-semibold tabular-nums',
                endpointStats.staleSuccess > 0 && 'text-warning',
              )}
            >
              {endpointsQuery.isLoading ? '—' : endpointStats.staleSuccess}
            </span>
            <span class="text-xs text-muted-foreground">Stale Success</span>
          </div>
          <span class="text-[11px] text-muted-foreground">over 48h</span>
        </div>

        <div class="w-px h-8 bg-border shrink-0"></div>

        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-1.5">
            <span class="text-lg font-semibold tabular-nums">
              {endpointsQuery.isLoading ? '—' : formatBytes(endpointStats.totalUsedStorage)}
            </span>
            <span class="text-xs text-muted-foreground">Used</span>
          </div>
          <span class="text-[11px] text-muted-foreground tabular-nums">
            {endpointsQuery.isLoading ? '—' : formatBytes(endpointStats.totalSelectedSize)} selected
          </span>
        </div>
      </div>

      <div class="flex-1 overflow-hidden">
        <InsightsPanel
          alerts={alertsQuery.data ?? []}
          loading={alertsQuery.isPending}
          onalertchange={refreshSiteAlerts}
        />
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
