<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { cn } from '$lib/utils';
  import { AlertSeverity } from '@mspbyte/shared';
  import { goto } from '$app/navigation';
  import type { createTrpcClient } from '$lib/trpc';
  import ScopedRow from '../_ScopedRow.svelte';
  import VendorInsightsPanel from '$lib/components/alerts/vendor-insights-panel.svelte';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');
  const queryClient = useQueryClient();

  const NOW = Date.now();

  // ── Global overview ──────────────────────────────────────────────────────
  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'sophos-partner', 'active'],
    queryFn: () =>
      trpc.integrationLinks.list.query({ integrationId: 'sophos-partner', status: 'active' }),
    enabled: !scopeStore.currentSite,
  }));

  const alertSummaryQuery = createQuery(() => ({
    queryKey: ['alerts.summaryByLink', 'sophos-partner', 'active'],
    queryFn: () =>
      trpc.alerts.summaryByLink.query({ integrationId: 'sophos-partner', status: 'active' }),
    enabled: !scopeStore.currentSite,
  }));

  // ── Per-site: resolve link ────────────────────────────────────────────────
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

  // ── Per-link: endpoint data ──────────────────────────────────────────────
  const endpointsQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'sophos_endpoints', currentLink],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'sophos_endpoints',
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
      healthIssues: eps.filter((e) => e['health'] !== 'good').length,
      tamperDisabled: eps.filter((e) => !e['tamper_protection_enabled']).length,
      needsUpgrade: eps.filter((e) => e['needs_upgrade']).length,
      stale60d: eps.filter(
        (e) =>
          !e['last_heartbeat_at'] ||
          NOW - Number(e['last_heartbeat_at']) > 60 * 86_400_000,
      ).length,
    };
  });

  // ── Global overview helpers ───────────────────────────────────────────────
  const links = $derived(linksQuery.data ?? []);

  const alertSummaryMap = $derived.by(() => {
    const map = new Map<
      string,
      { alertCount: number; highestSeverity: number | null; criticalCount: number; highCount: number }
    >();
    for (const row of alertSummaryQuery.data ?? []) {
      if (row.linkId) map.set(row.linkId, row);
    }
    return map;
  });

  let searchQuery = $state('');

  const filteredLinks = $derived(
    searchQuery.trim()
      ? links.filter((l) =>
          (l.name ?? l.externalId ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : links,
  );

  const criticalCount = $derived(
    filteredLinks.filter((l) => {
      const m = alertSummaryMap.get(l.id);
      return (m?.highestSeverity ?? -1) >= AlertSeverity.High;
    }).length,
  );

  const warningCount = $derived(
    filteredLinks.filter((l) => {
      const m = alertSummaryMap.get(l.id);
      return (
        (m?.highestSeverity ?? -1) >= AlertSeverity.Low &&
        (m?.highestSeverity ?? -1) < AlertSeverity.High
      );
    }).length,
  );

  const healthyCount = $derived(
    filteredLinks.filter((l) => {
      const m = alertSummaryMap.get(l.id);
      return (m?.alertCount ?? 0) === 0;
    }).length,
  );

  function selectSite(link: { siteId?: string | null }) {
    if (link.siteId) scopeStore.currentSite = link.siteId;
    goto('/sophos-partner');
  }

  function refreshSiteAlerts() {
    queryClient.invalidateQueries({
      queryKey: ['alerts.insightGroups', 'sophos-partner', scopeStore.currentSite, currentLink, 'active'],
    });
    queryClient.invalidateQueries({ queryKey: ['alerts.insightGroupCounts', 'sophos-partner'] });
    queryClient.invalidateQueries({ queryKey: ['alerts.summaryByLink', 'sophos-partner', 'active'] });
  }

  const insightFilters = [
    {
      id: 'tamper',
      label: 'Tamper',
      definitionPrefixes: ['sophos.endpoint.tamper_protection'],
    },
  ];

  function moduleLabelForDefinition(definitionId: string) {
    if (definitionId === 'sophos.endpoint.tamper_protection') return 'Tamper';
    return 'Other';
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
      <div class="text-sm font-medium">No Sophos Partner integration for this site.</div>
    </div>
  {:else}
    <div class="flex flex-col size-full overflow-hidden">
      <div class="flex items-center gap-5 px-4 py-2.5 border-b shrink-0 flex-wrap">
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
                endpointStats.healthIssues > 0 && 'text-destructive',
              )}
            >
              {endpointsQuery.isLoading ? '—' : endpointStats.healthIssues}
            </span>
            <span class="text-xs text-muted-foreground">Health Issues</span>
          </div>
        </div>

        <div class="w-px h-8 bg-border shrink-0"></div>

        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-1.5">
            <span
              class={cn(
                'text-lg font-semibold tabular-nums',
                endpointStats.tamperDisabled > 0 && 'text-destructive',
              )}
            >
              {endpointsQuery.isLoading ? '—' : endpointStats.tamperDisabled}
            </span>
            <span class="text-xs text-muted-foreground">Tamper Disabled</span>
          </div>
          <span class="text-[11px] text-muted-foreground">AV unprotected</span>
        </div>

        <div class="w-px h-8 bg-border shrink-0"></div>

        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-1.5">
            <span
              class={cn(
                'text-lg font-semibold tabular-nums',
                endpointStats.needsUpgrade > 0 && 'text-warning',
              )}
            >
              {endpointsQuery.isLoading ? '—' : endpointStats.needsUpgrade}
            </span>
            <span class="text-xs text-muted-foreground">Needs Upgrade</span>
          </div>
          <span class="text-[11px] text-muted-foreground">outdated agent</span>
        </div>

        <div class="w-px h-8 bg-border shrink-0"></div>

        <div class="flex flex-col gap-0.5">
          <div class="flex items-baseline gap-1.5">
            <span
              class={cn(
                'text-lg font-semibold tabular-nums',
                endpointStats.stale60d > 0 && 'text-muted-foreground',
              )}
            >
              {endpointsQuery.isLoading ? '—' : endpointStats.stale60d}
            </span>
            <span class="text-xs text-muted-foreground">Stale 60d</span>
          </div>
          <span class="text-[11px] text-muted-foreground">no heartbeat</span>
        </div>
      </div>

      <div class="flex-1 overflow-hidden">
        <VendorInsightsPanel
          integrationId="sophos-partner"
          siteId={scopeStore.currentSite}
          linkId={currentLink}
          alertsHref="/sophos-partner/alerts"
          filters={insightFilters}
          entityHeading="Endpoint"
          {moduleLabelForDefinition}
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
          {linksQuery.isPending ? '—' : filteredLinks.length}
        </div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          High/Critical
        </div>
        <div class="text-3xl font-bold tabular-nums text-destructive">
          {linksQuery.isPending ? '—' : criticalCount}
        </div>
        <div class="text-xs text-muted-foreground">highest alert severity</div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Low/Medium
        </div>
        <div class="text-3xl font-bold tabular-nums text-warning">
          {linksQuery.isPending ? '—' : warningCount}
        </div>
        <div class="text-xs text-muted-foreground">highest alert severity</div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Healthy
        </div>
        <div class="text-3xl font-bold tabular-nums text-success">
          {linksQuery.isPending ? '—' : healthyCount}
        </div>
        <div class="text-xs text-muted-foreground">no open alerts</div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4 flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search sites..."
          bind:value={searchQuery}
          class="h-8 w-64 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {#if linksQuery.isLoading}
        <div class="flex items-center justify-center h-32 text-sm text-muted-foreground">
          Loading sites...
        </div>
      {:else if filteredLinks.length === 0}
        <div class="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
          {#if links.length === 0}
            <div class="text-sm">No Sophos Partner sites connected.</div>
            <a href="/setup/integrations" class="text-xs text-primary hover:underline">
              Configure integration →
            </a>
          {:else}
            <div class="text-sm">No sites match your search.</div>
          {/if}
        </div>
      {:else}
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-xs text-muted-foreground uppercase tracking-wide">
              <th class="px-4 py-2 text-left w-8"></th>
              <th class="px-4 py-2 text-left">Site</th>
              <th class="px-4 py-2 text-center w-24">Alerts</th>
              <th class="px-4 py-2 text-center w-40">Compliance Failures</th>
              <th class="px-4 py-2 text-center w-28">Status</th>
            </tr>
          </thead>
          <tbody>
          {#each filteredLinks as link (link.id)}
            {@const summary = alertSummaryMap.get(link.id)}
            <ScopedRow
              {link}
              label="Site"
              onclick={selectSite}
              alertCount={summary?.alertCount ?? 0}
              highestSeverity={summary?.highestSeverity ?? null}
              loading={alertSummaryQuery.isPending}
            />
          {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}
