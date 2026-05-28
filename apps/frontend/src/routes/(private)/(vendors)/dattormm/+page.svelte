<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { cn } from '$lib/utils';
  import { goto } from '$app/navigation';
  import type { createTrpcClient } from '$lib/trpc';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  const NOW = Date.now();

  // ── Global overview ──────────────────────────────────────────────────────
  const sitesQuery = createQuery(() => ({
    queryKey: ['sites.list'],
    queryFn: () => trpc.sites.list.query(),
    enabled: !scopeStore.currentSite,
  }));

  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'dattormm', 'active'],
    queryFn: () =>
      trpc.integrationLinks.list.query({ integrationId: 'dattormm', status: 'active' }),
    enabled: !scopeStore.currentSite,
  }));

  // ── Per-site: resolve link ────────────────────────────────────────────────
  const siteLinkQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'dattormm', scopeStore.currentSite],
    queryFn: () =>
      trpc.integrationLinks.list.query({
        integrationId: 'dattormm',
        siteId: scopeStore.currentSite!,
      }),
    enabled: !!scopeStore.currentSite,
  }));

  const currentLink = $derived(siteLinkQuery.data?.[0]?.id ?? null);

  // ── Per-link: endpoint overview data ────────────────────────────────────
  const endpointsQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'datto_endpoints', currentLink],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'datto_endpoints',
        linkId: currentLink!,
        page: 1,
        pageSize: 1000,
      }),
    enabled: !!currentLink && !!scopeStore.currentSite,
  }));

  type EndpointRow = Record<string, unknown>;

  const endpointStats = $derived.by(() => {
    const eps = (endpointsQuery.data?.rows ?? []) as EndpointRow[];
    return {
      total: eps.length,
      offline: eps.filter((e) => !e['online']).length,
      stale60d: eps.filter(
        (e) =>
          !e['last_heartbeat_at'] ||
          NOW - Number(e['last_heartbeat_at']) > 60 * 86_400_000,
      ).length,
    };
  });

  const siteNameById = $derived.by(() => {
    const map = new Map<string, string>();
    for (const site of sitesQuery.data ?? []) map.set(site.id, site.name);
    return map;
  });

  const links = $derived(linksQuery.data ?? []);

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
    goto('/dattormm');
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
      <div class="text-sm font-medium">No DattoRMM integration for this site.</div>
    </div>
  {:else}
    <div class="flex flex-col size-full overflow-y-auto p-4 gap-4">
      <!-- KPI strip -->
      <div class="grid grid-cols-3 gap-3">
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
            Offline
          </div>
          <div
            class="text-3xl font-bold tabular-nums {endpointStats.offline > 0
              ? 'text-destructive'
              : ''}"
          >
            {endpointsQuery.isLoading ? '—' : endpointStats.offline}
          </div>
          <div class="text-xs text-muted-foreground">currently unreachable</div>
        </div>
        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Stale (60d)
          </div>
          <div
            class="text-3xl font-bold tabular-nums {endpointStats.stale60d > 0
              ? 'text-warning'
              : ''}"
          >
            {endpointsQuery.isLoading ? '—' : endpointStats.stale60d}
          </div>
          <div class="text-xs text-muted-foreground">no heartbeat</div>
        </div>
      </div>

      <!-- Quick links -->
      <div class="flex flex-wrap gap-2">
        <a
          href="/dattormm/endpoints"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >
          Endpoints →
        </a>
      </div>
    </div>
  {/if}
{:else}
  <!-- ── Global sites overview ──────────────────────────────────────────── -->
  <div class="flex flex-col size-full overflow-hidden">
    <div class="grid grid-cols-2 gap-3 p-4 border-b shrink-0">
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Total Sites
        </div>
        <div class="text-3xl font-bold tabular-nums">
          {linksQuery.isLoading ? '—' : links.length}
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
          <div class="text-sm">No DattoRMM sites connected.</div>
          <a href="/setup/integrations" class="text-xs text-primary hover:underline">
            Configure integration →
          </a>
        </div>
      {:else}
        <div class="flex flex-col gap-1">
          {#each links as link}
            <button
              onclick={() => selectSite(link)}
              class="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left w-full"
            >
              <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-success"></span>
              <span class="font-medium text-sm flex-1">
                {(link.siteId ? siteNameById.get(link.siteId) : null) ?? link.name ?? link.externalId ?? link.id}
              </span>
              <span class="text-xs text-muted-foreground">{relativeTime(link.updatedAt)}</span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/15 text-success"
              >
                Active
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
