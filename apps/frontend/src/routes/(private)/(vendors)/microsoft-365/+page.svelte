<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { goto } from '$app/navigation';
  import { SvelteMap } from 'svelte/reactivity';
  import TenantRow from './_TenantRow.svelte';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  // ── Global overview ──────────────────────────────────────────────────────
  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'microsoft-365', 'active'],
    queryFn: () =>
      trpc.integrationLinks.list.query({ integrationId: 'microsoft-365', status: 'active' }),
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

  // ── Derived stats ─────────────────────────────────────────────────────────
  const NOW = Date.now();

  const identityStats = $derived.by(() => {
    const ids = (identitiesQuery.data?.rows ?? []) as Array<{
      mfaEnforced: boolean;
      lastSignInAt: string | null;
    }>;
    const noMfa = ids.filter((u) => u.mfaEnforced === false).length;
    const stale = ids.filter(
      (u) => !u.lastSignInAt || NOW - new Date(u.lastSignInAt).getTime() > 30 * 86_400_000,
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
      0,
    );
    return { skus: lics.length, unused };
  });

  const policyStats = $derived.by(() => {
    const pols = (policiesQuery.data?.rows ?? []) as Array<{ policyState: string }>;
    const enabled = pols.filter(
      (p) =>
        p.policyState === 'enabled' || p.policyState === 'enabledForReportingButNotEnforced',
    ).length;
    return { total: pols.length, enabled };
  });

  const mfaPct = $derived.by(() => {
    const ids = (identitiesQuery.data?.rows ?? []) as Array<{ mfaEnforced: boolean }>;
    if (!ids.length) return 0;
    return Math.round((ids.filter((u) => u.mfaEnforced !== false).length / ids.length) * 100);
  });

  const staleRanges = $derived.by(() => {
    const ids = (identitiesQuery.data?.rows ?? []) as Array<{ lastSignInAt: string | null }>;
    const buckets = [
      { label: '< 7d', min: 0, max: 7, color: 'var(--success)' },
      { label: '7–30d', min: 7, max: 30, color: 'var(--warning)' },
      { label: '30–90d', min: 30, max: 90, color: 'oklch(0.65 0.18 40)' },
      { label: '> 90d', min: 90, max: Infinity, color: 'var(--destructive)' },
    ];
    return buckets.map((b) => {
      const count = ids.filter((u) => {
        if (!u.lastSignInAt) return b.max === Infinity;
        const days = (NOW - new Date(u.lastSignInAt).getTime()) / 86_400_000;
        return days >= b.min && days < b.max;
      }).length;
      return {
        ...b,
        count,
        pct: ids.length ? Math.round((count / ids.length) * 100) : 0,
      };
    });
  });

  // ── Global overview helpers ───────────────────────────────────────────────
  const metricsMap = new SvelteMap<string, { alertCount: number; complianceFailures: number }>();

  function handleMetrics(linkId: string, alertCount: number, complianceFailures: number) {
    metricsMap.set(linkId, { alertCount, complianceFailures });
  }

  const links = $derived(linksQuery.data ?? []);

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
      const m = metricsMap.get(l.id);
      return (m?.complianceFailures ?? 0) > 0 || (m?.alertCount ?? 0) > 10;
    }).length,
  );

  const warningCount = $derived(
    filteredLinks.filter((l) => {
      const m = metricsMap.get(l.id);
      return (
        (m?.complianceFailures ?? 0) === 0 &&
        (m?.alertCount ?? 0) > 0 &&
        (m?.alertCount ?? 0) <= 10
      );
    }).length,
  );

  const healthyCount = $derived(
    filteredLinks.filter((l) => {
      const m = metricsMap.get(l.id);
      return (m?.complianceFailures ?? 0) === 0 && (m?.alertCount ?? 0) === 0;
    }).length,
  );

  function selectTenant(link: { id: string }) {
    scopeStore.currentLink = link.id;
    goto('/microsoft-365');
  }
</script>

{#if scopeStore.currentLink}
  <!-- ── Per-tenant dashboard ──────────────────────────────────────────── -->
  <div class="flex flex-col size-full overflow-y-auto p-4 gap-4">
    <!-- KPI strip -->
    <div class="grid grid-cols-4 gap-3">
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Total Identities
        </div>
        <div class="text-3xl font-bold tabular-nums">
          {identitiesQuery.isPending ? '—' : identityStats.total}
        </div>
        <div class="text-xs text-muted-foreground">{identityStats.stale} stale</div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          No MFA
        </div>
        <div class="text-3xl font-bold tabular-nums text-destructive">
          {identitiesQuery.isPending ? '—' : identityStats.noMfa}
        </div>
        <div class="text-xs text-muted-foreground">require enabling</div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Unused Seats
        </div>
        <div class="text-3xl font-bold tabular-nums text-destructive">
          {licensesQuery.isPending ? '—' : licenseStats.unused}
        </div>
        <div class="text-xs text-muted-foreground">across {licenseStats.skus} SKUs</div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Active Policies
        </div>
        <div class="text-3xl font-bold tabular-nums text-primary">
          {policiesQuery.isPending ? '—' : policyStats.enabled}
        </div>
        <div class="text-xs text-muted-foreground">of {policyStats.total} total</div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-lg border bg-card p-4">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          MFA Status
        </div>
        {#if identitiesQuery.isPending}
          <div class="h-24 bg-muted rounded animate-pulse"></div>
        {:else}
          <div class="flex items-center gap-4">
            <div class="relative shrink-0" style="width:72px;height:72px">
              <svg width="72" height="72" style="transform:rotate(-90deg)">
                <circle cx="36" cy="36" r="31" fill="none" stroke="var(--border)" stroke-width="8" />
                <circle
                  cx="36"
                  cy="36"
                  r="31"
                  fill="none"
                  stroke="var(--success)"
                  stroke-width="8"
                  stroke-dasharray="{(mfaPct / 100) * 2 * Math.PI * 31} {(1 - mfaPct / 100) *
                    2 *
                    Math.PI *
                    31}"
                  stroke-linecap="round"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {mfaPct}%
              </div>
            </div>
            <div class="flex flex-col gap-1.5 text-xs">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-success inline-block"></span>
                Enabled: {identityStats.total - identityStats.noMfa}
              </div>
              <div class="flex items-center gap-1.5 text-destructive">
                <span class="w-2 h-2 rounded-full bg-destructive inline-block"></span>
                Disabled: {identityStats.noMfa}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="rounded-lg border bg-card p-4">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Last Sign-in
        </div>
        {#if identitiesQuery.isPending}
          <div class="h-24 bg-muted rounded animate-pulse"></div>
        {:else}
          <div class="flex flex-col gap-2">
            {#each staleRanges as range}
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-muted-foreground">{range.label}</span>
                  <span style="color:{range.color}">{range.count}</span>
                </div>
                <div class="w-full h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    style="width:{range.pct}%;background:{range.color};height:100%;border-radius:9999px;transition:width 0.4s"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Quick links -->
    <div class="flex flex-wrap gap-2">
      <a
        href="/microsoft-365/identities"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >Identities →</a
      >
      <a
        href="/microsoft-365/licenses"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >Licenses →</a
      >
      <a
        href="/microsoft-365/policies"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >Policies →</a
      >
      <a
        href="/microsoft-365/groups"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >Groups →</a
      >
    </div>
  </div>
{:else}
  <!-- ── Global tenants overview ───────────────────────────────────────── -->
  <div class="flex flex-col size-full overflow-hidden">
    <!-- Summary strip -->
    <div class="grid grid-cols-4 gap-3 p-4 border-b shrink-0">
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
          Critical
        </div>
        <div class="text-3xl font-bold tabular-nums text-destructive">
          {linksQuery.isPending ? '—' : criticalCount}
        </div>
        <div class="text-xs text-muted-foreground">10+ alerts</div>
      </div>
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Warnings
        </div>
        <div class="text-3xl font-bold tabular-nums text-warning">
          {linksQuery.isPending ? '—' : warningCount}
        </div>
        <div class="text-xs text-muted-foreground">have open alerts</div>
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
        <div class="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Loading tenants...
        </div>
      {:else if filteredLinks.length === 0}
        <div class="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
          {#if links.length === 0}
            <div class="text-sm">No Microsoft 365 tenants connected.</div>
            <a href="/setup/integrations" class="text-xs text-primary hover:underline">
              Configure integration →
            </a>
          {:else}
            <div class="text-sm">No tenants match your search.</div>
          {/if}
        </div>
      {:else}
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-xs text-muted-foreground uppercase tracking-wide">
              <th class="px-4 py-2 text-left w-8"></th>
              <th class="px-4 py-2 text-left">Tenant</th>
              <th class="px-4 py-2 text-center w-24">Alerts</th>
              <th class="px-4 py-2 text-center w-40">Compliance Failures</th>
              <th class="px-4 py-2 text-right w-32">Last Sync</th>
              <th class="px-4 py-2 text-center w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredLinks as link (link.id)}
              <TenantRow
                {link}
                onclick={selectTenant}
                onmetrics={(ac, cf) => handleMetrics(link.id, ac, cf)}
              />
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}
