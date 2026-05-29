<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery, useQueryClient } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { goto } from '$app/navigation';
  import { cn } from '$lib/utils';
  import TenantRow from './_TenantRow.svelte';
  import InsightsPanel from './_InsightsPanel.svelte';
  import { AlertSeverity } from '@mspbyte/shared';
  import Loader from '$lib/components/transition/loader.svelte';
  import FadeIn from '$lib/components/transition/fade-in.svelte';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');
  const queryClient = useQueryClient();

  // ── Global overview ──────────────────────────────────────────────────────
  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'microsoft-365', 'active'],
    queryFn: () =>
      trpc.integrationLinks.list.query({ integrationId: 'microsoft-365', status: 'active' }),
    enabled: !scopeStore.currentLink,
  }));

  const alertSummaryQuery = createQuery(() => ({
    queryKey: ['alerts.summaryByLink', 'microsoft-365', 'active'],
    queryFn: () =>
      trpc.alerts.summaryByLink.query({ integrationId: 'microsoft-365', status: 'active' }),
    enabled: !scopeStore.currentLink,
  }));

  // ── Per-tenant data ───────────────────────────────────────────────────────
  const identitiesQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'm365_identities', scopeStore.currentLink],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'm365_identities',
        linkId: scopeStore.currentLink!,
        page: 1,
        pageSize: 1000,
      }),
    enabled: !!scopeStore.currentLink,
  }));

  const licensesQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'm365_licenses', scopeStore.currentLink],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'm365_licenses',
        linkId: scopeStore.currentLink!,
        page: 1,
        pageSize: 1000,
      }),
    enabled: !!scopeStore.currentLink,
  }));

  const policiesQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'm365_policies', scopeStore.currentLink],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'm365_policies',
        linkId: scopeStore.currentLink!,
        page: 1,
        pageSize: 1000,
      }),
    enabled: !!scopeStore.currentLink,
  }));

  function refreshTenantAlerts() {
    queryClient.invalidateQueries({
      queryKey: ['alerts.insightGroups', 'microsoft-365', scopeStore.currentLink, 'active'],
    });
    queryClient.invalidateQueries({
      queryKey: ['alerts.summaryByLink', 'microsoft-365', 'active'],
    });
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const identityStats = $derived.by(() => {
    const ids = (identitiesQuery.data?.rows ?? []) as Array<{
      mfaEnforced: boolean;
      lastSignInAt: string | null;
    }>;
    const now = Date.now();
    const noMfa = ids.filter((u) => u.mfaEnforced === false).length;
    const stale = ids.filter(
      (u) => !u.lastSignInAt || now - new Date(u.lastSignInAt).getTime() > 30 * 86_400_000
    ).length;
    return { total: ids.length, noMfa, stale };
  });

  const licenseStats = $derived.by(() => {
    const lics = (licensesQuery.data?.rows ?? []) as Array<{
      totalUnits: number;
      consumedUnits: number;
    }>;
    const unused = lics.reduce(
      (sum, l) => sum + Math.max(0, (l.totalUnits ?? 0) - (l.consumedUnits ?? 0)),
      0
    );
    return { skus: lics.length, unused };
  });

  const policyStats = $derived.by(() => {
    const pols = (policiesQuery.data?.rows ?? []) as Array<{ policyState: string }>;
    const enabled = pols.filter(
      (p) => p.policyState === 'enabled' || p.policyState === 'enabledForReportingButNotEnforced'
    ).length;
    return { total: pols.length, enabled };
  });

  const mfaPct = $derived.by(() => {
    const ids = (identitiesQuery.data?.rows ?? []) as Array<{ mfaEnforced: boolean }>;
    if (!ids.length) return 0;
    return Math.round((ids.filter((u) => u.mfaEnforced !== false).length / ids.length) * 100);
  });

  const metricsLoading = $derived(
    identitiesQuery.isPending || licensesQuery.isPending || policiesQuery.isPending
  );

  // ── Global overview helpers ───────────────────────────────────────────────
  const links = $derived(linksQuery.data ?? []);

  const alertSummaryMap = $derived.by(() => {
    const map = new Map<
      string,
      {
        alertCount: number;
        highestSeverity: number | null;
        criticalCount: number;
        highCount: number;
      }
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
          (l.name ?? l.externalId ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : links
  );

  const criticalCount = $derived(
    filteredLinks.filter((l) => {
      const m = alertSummaryMap.get(l.id);
      return (m?.highestSeverity ?? -1) >= AlertSeverity.High;
    }).length
  );

  const warningCount = $derived(
    filteredLinks.filter((l) => {
      const m = alertSummaryMap.get(l.id);
      return (
        (m?.highestSeverity ?? -1) >= AlertSeverity.Low &&
        (m?.highestSeverity ?? -1) < AlertSeverity.High
      );
    }).length
  );

  const healthyCount = $derived(
    filteredLinks.filter((l) => {
      const m = alertSummaryMap.get(l.id);
      return (m?.alertCount ?? 0) === 0;
    }).length
  );

  function selectTenant(link: { id: string }) {
    scopeStore.currentLink = link.id;
    goto('/microsoft-365');
  }
</script>

{#if scopeStore.currentLink}
  <!-- ── Per-tenant dashboard ──────────────────────────────────────────── -->
  <div class="flex flex-col size-full overflow-hidden">
    <!-- Compact metrics strip -->
    <div class="flex items-center gap-5 px-4 py-2.5 border-b shrink-0 flex-wrap">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-baseline gap-1.5">
          <span class="text-lg font-semibold tabular-nums">
            {metricsLoading ? '—' : identityStats.total}
          </span>
          <span class="text-xs text-muted-foreground">Identities</span>
        </div>
        {#if !metricsLoading && identityStats.stale > 0}
          <span class="text-[11px] text-warning tabular-nums">{identityStats.stale} stale</span>
        {/if}
      </div>

      <div class="w-px h-8 bg-border shrink-0"></div>

      <div class="flex flex-col gap-0.5">
        <div class="flex items-baseline gap-1.5">
          <span
            class={cn(
              'text-lg font-semibold tabular-nums',
              !metricsLoading && identityStats.noMfa > 0 && 'text-destructive'
            )}
          >
            {metricsLoading ? '—' : identityStats.noMfa}
          </span>
          <span class="text-xs text-muted-foreground">No MFA</span>
        </div>
        {#if !metricsLoading}
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-muted-foreground tabular-nums">{mfaPct}% coverage</span>
            <div class="w-12 h-1 rounded-full bg-border overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                style="width:{mfaPct}%;background:var(--success)"
              ></div>
            </div>
          </div>
        {/if}
      </div>

      <div class="w-px h-8 bg-border shrink-0"></div>

      <div class="flex flex-col gap-0.5">
        <div class="flex items-baseline gap-1.5">
          <span
            class={cn(
              'text-lg font-semibold tabular-nums',
              !metricsLoading && licenseStats.unused > 0 && 'text-destructive'
            )}
          >
            {metricsLoading ? '—' : licenseStats.unused}
          </span>
          <span class="text-xs text-muted-foreground">Unused Seats</span>
        </div>
        {#if !metricsLoading}
          <span class="text-[11px] text-muted-foreground tabular-nums">
            {licenseStats.skus} SKUs
          </span>
        {/if}
      </div>

      <div class="w-px h-8 bg-border shrink-0"></div>

      <div class="flex flex-col gap-0.5">
        <div class="flex items-baseline gap-1.5">
          <span class="text-lg font-semibold tabular-nums">
            {metricsLoading ? '—' : policyStats.enabled}
          </span>
          <span class="text-xs text-muted-foreground">
            / {metricsLoading ? '—' : policyStats.total} Policies
          </span>
        </div>
      </div>
    </div>

    <!-- Insights panel fills remaining space -->
    <div class="flex-1 overflow-hidden">
      <InsightsPanel linkId={scopeStore.currentLink} onalertchange={refreshTenantAlerts} />
    </div>
  </div>
{:else}
  <!-- ── Global tenants overview ───────────────────────────────────────── -->
  <div class="flex flex-col size-full overflow-hidden">
    <!-- Summary strip -->
    <div
      class={cn(
        'grid grid-cols-4 gap-3 p-4 border-b shrink-0',
        linksQuery.isPending && 'animate-pulse'
      )}
    >
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Total Tenants
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

    <!-- Search + Tenant table -->
    <div class="flex-1 overflow-auto p-4 flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search tenants…"
          bind:value={searchQuery}
          class="h-8 w-64 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {#if linksQuery.isPending}
        <Loader />
      {:else if filteredLinks.length === 0}
        <FadeIn class="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
          {#if links.length === 0}
            <div class="text-sm">No Microsoft 365 tenants connected.</div>
            <a href="/setup/integrations" class="text-xs text-primary hover:underline">
              Configure integration →
            </a>
          {:else}
            <div class="text-sm">No tenants match your search.</div>
          {/if}
        </FadeIn>
      {:else}
        <FadeIn class="flex-1">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-xs text-muted-foreground uppercase tracking-wide">
                <th class="px-4 py-2 text-left w-8"></th>
                <th class="px-4 py-2 text-left">Tenant</th>
                <th class="px-4 py-2 text-center w-24">Alerts</th>
                <th class="px-4 py-2 text-center w-40">Compliance Failures</th>
                <th class="px-4 py-2 text-center w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredLinks as link (link.id)}
                {@const summary = alertSummaryMap.get(link.id)}
                <TenantRow
                  {link}
                  onclick={selectTenant}
                  alertCount={summary?.alertCount ?? 0}
                  highestSeverity={summary?.highestSeverity ?? null}
                  loading={alertSummaryQuery.isPending}
                />
              {/each}
            </tbody>
          </table>
        </FadeIn>
      {/if}
    </div>
  </div>
{/if}
