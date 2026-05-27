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
  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'sophos-partner', 'active'],
    queryFn: () =>
      trpc.integrationLinks.list.query({ integrationId: 'sophos-partner', status: 'active' }),
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
        tenantId: scopeStore.currentSite!,
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

  const platformCounts = $derived.by(() => {
    const eps = (endpointsQuery.data?.rows ?? []) as EndpointRow[];
    const map = new Map<string, number>();
    for (const e of eps) {
      const key = String(e['platform'] ?? 'unknown');
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const total = eps.length || 1;
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }));
  });

  const typeCounts = $derived.by(() => {
    const eps = (endpointsQuery.data?.rows ?? []) as EndpointRow[];
    const computers = eps.filter((e) => String(e['type'] ?? '').toLowerCase() !== 'server').length;
    const servers = eps.filter((e) => String(e['type'] ?? '').toLowerCase() === 'server').length;
    const total = eps.length || 1;
    return [
      {
        label: 'Computer',
        count: computers,
        pct: Math.round((computers / total) * 100),
        color: 'var(--primary)',
      },
      {
        label: 'Server',
        count: servers,
        pct: Math.round((servers / total) * 100),
        color: 'var(--warning)',
      },
    ];
  });

  // ── Global overview helpers ───────────────────────────────────────────────
  const links = $derived(linksQuery.data ?? []);

  const platformColors: Record<string, string> = {
    windows: 'var(--primary)',
    linux: 'var(--warning)',
    mac: 'oklch(0.65 0.18 40)',
    unknown: 'var(--muted-foreground)',
  };

  function platformColor(label: string) {
    return platformColors[label.toLowerCase()] ?? 'var(--primary)';
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
    goto('/sophos-partner');
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
    <div class="flex flex-col size-full overflow-y-auto p-4 gap-4">
      <!-- KPI strip -->
      <div class="grid grid-cols-5 gap-3">
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
            Health Issues
          </div>
          <div class="text-3xl font-bold tabular-nums text-destructive">
            {endpointsQuery.isLoading ? '—' : endpointStats.healthIssues}
          </div>
          <div class="text-xs text-muted-foreground">require attention</div>
        </div>
        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tamper Disabled
          </div>
          <div class="text-3xl font-bold tabular-nums text-destructive">
            {endpointsQuery.isLoading ? '—' : endpointStats.tamperDisabled}
          </div>
          <div class="text-xs text-muted-foreground">AV unprotected</div>
        </div>
        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Needs Upgrade
          </div>
          <div class="text-3xl font-bold tabular-nums text-warning">
            {endpointsQuery.isLoading ? '—' : endpointStats.needsUpgrade}
          </div>
          <div class="text-xs text-muted-foreground">outdated agent</div>
        </div>
        <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Stale 60d
          </div>
          <div class="text-3xl font-bold tabular-nums text-muted-foreground">
            {endpointsQuery.isLoading ? '—' : endpointStats.stale60d}
          </div>
          <div class="text-xs text-muted-foreground">no heartbeat</div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-lg border bg-card p-4">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Platform Distribution
          </div>
          {#if endpointsQuery.isLoading}
            <div class="h-24 bg-muted rounded animate-pulse"></div>
          {:else}
            <div class="flex flex-col gap-2">
              {#each platformCounts as p}
                <div>
                  <div class="flex justify-between text-xs mb-1">
                    <span class="text-muted-foreground capitalize">{p.label}</span>
                    <span style="color:{platformColor(p.label)}">{p.count}</span>
                  </div>
                  <div class="w-full h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      style="width:{p.pct}%;background:{platformColor(p.label)};height:100%;border-radius:9999px;transition:width 0.4s"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="rounded-lg border bg-card p-4">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Endpoint Types
          </div>
          {#if endpointsQuery.isLoading}
            <div class="h-24 bg-muted rounded animate-pulse"></div>
          {:else}
            <div class="flex items-center gap-6">
              <div class="relative shrink-0" style="width:72px;height:72px">
                <svg width="72" height="72" style="transform:rotate(-90deg)">
                  <circle cx="36" cy="36" r="31" fill="none" stroke="var(--border)" stroke-width="8" />
                  {#each typeCounts as seg, i}
                    {@const offset = typeCounts.slice(0, i).reduce((s, t) => s + t.pct, 0)}
                    {@const circ = 2 * Math.PI * 31}
                    <circle
                      cx="36"
                      cy="36"
                      r="31"
                      fill="none"
                      stroke={seg.color}
                      stroke-width="8"
                      stroke-dasharray="{(seg.pct / 100) * circ} {circ}"
                      stroke-dashoffset="{-(offset / 100) * circ}"
                      stroke-linecap="butt"
                    />
                  {/each}
                </svg>
                <div
                  class="absolute inset-0 flex items-center justify-center text-sm font-bold"
                >
                  {endpointStats.total}
                </div>
              </div>
              <div class="flex flex-col gap-2 text-xs">
                {#each typeCounts as t}
                  <div class="flex items-center gap-1.5">
                    <span
                      class="w-2 h-2 rounded-full inline-block"
                      style="background:{t.color}"
                    ></span>
                    <span class="text-muted-foreground">{t.label}:</span>
                    <span class="font-medium">{t.count}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Quick links -->
      <div class="flex flex-wrap gap-2">
        <a
          href="/sophos-partner/endpoints"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >
          Endpoints →
        </a>
        <a
          href="/sophos-partner/firewalls"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >
          Firewalls →
        </a>
        <a
          href="/sophos-partner/licenses"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium hover:bg-accent transition-colors"
        >
          Licenses →
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
      <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</div>
        <div class="text-3xl font-bold tabular-nums text-success">
          {linksQuery.isLoading ? '—' : links.filter((l) => l.status === 'active').length}
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
          <div class="text-sm">No Sophos Partner sites connected.</div>
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
                {link.name ?? link.externalId ?? link.id}
              </span>
              <span class="text-xs text-muted-foreground">{relativeTime(link.updatedAt)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
