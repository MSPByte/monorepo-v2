<script lang="ts">
  import { AlertSeverity } from '@mspbyte/shared';
  import AlertSuppress from '$lib/components/alerts/alert-suppress.svelte';
  import { cn } from '$lib/utils';
  import type { UiAlert } from '$lib/components/alerts/types';
  import { groupByEntity, moduleForAlert, type M365AlertModuleId } from './_alert-modules';
  import {
    alertMetadataEntries,
    alertSearchText,
    alertTitle,
    formatAlertValue,
    hydratedAlertMessage,
    metadataLabel,
  } from '$lib/components/alerts/display';
  import { ChevronRight, Search } from '@lucide/svelte';

  let {
    alerts,
    loading,
    onalertchange,
  }: {
    alerts: UiAlert[];
    loading: boolean;
    onalertchange?: () => void;
  } = $props();

  let activeFilter = $state<M365AlertModuleId | 'all'>('all');
  let searchQuery = $state('');
  let suppressId = $state<string | null>(null);
  let suppressAlert = $state<UiAlert | null>(null);
  let suppressOpen = $state(false);
  let expandedEntities = $state<Set<string>>(new Set());

  const filteredAlerts = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();
    return alerts.filter((alert) => {
      if (activeFilter !== 'all' && moduleForAlert(alert).id !== activeFilter) return false;
      if (!query) return true;
      return alertSearchText(alert).includes(query);
    });
  });

  const entities = $derived(groupByEntity(filteredAlerts));

  const moduleCounts = $derived.by(() => {
    const counts = new Map<M365AlertModuleId, number>();
    for (const alert of alerts) {
      const mod = moduleForAlert(alert).id;
      counts.set(mod, (counts.get(mod) ?? 0) + 1);
    }
    return counts;
  });

  const FILTER_OPTIONS: { id: M365AlertModuleId | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'identities', label: 'Identities' },
    { id: 'licenses', label: 'Licenses' },
    { id: 'exchange', label: 'Exchange' },
    { id: 'other', label: 'Other' },
  ];

  function severityDot(severity: number) {
    if (severity === AlertSeverity.Critical) return 'bg-destructive';
    if (severity === AlertSeverity.High) return 'bg-destructive/80';
    if (severity === AlertSeverity.Medium) return 'bg-warning';
    return 'bg-muted-foreground/40';
  }

  function severityBadge(severity: number) {
    if (severity === AlertSeverity.Critical) return 'bg-destructive/15 text-destructive';
    if (severity === AlertSeverity.High) return 'bg-destructive/10 text-destructive/80';
    if (severity === AlertSeverity.Medium) return 'bg-warning/15 text-warning';
    return 'bg-muted text-muted-foreground';
  }

  function severityLabel(severity: number) {
    if (severity === AlertSeverity.Critical) return 'Critical';
    if (severity === AlertSeverity.High) return 'High';
    if (severity === AlertSeverity.Medium) return 'Medium';
    return 'Low';
  }

  function relativeTime(ts?: Date | string | null) {
    if (!ts) return '—';
    const time = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
    if (Number.isNaN(time)) return '—';
    const diff = Date.now() - time;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  function openSuppress(alert: UiAlert) {
    suppressId = alert.id;
    suppressAlert = alert;
    suppressOpen = true;
  }

  function isExpanded(entityKey: string) {
    return expandedEntities.has(entityKey);
  }

  function toggleEntity(entityKey: string) {
    const next = new Set(expandedEntities);
    if (next.has(entityKey)) next.delete(entityKey);
    else next.add(entityKey);
    expandedEntities = next;
  }
</script>

<div class="flex flex-col size-full overflow-hidden">
  <div class="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
    <div class="flex items-center gap-2">
      <h2 class="font-semibold text-sm">Insights</h2>
      {#if !loading}
        <span class="text-xs text-muted-foreground tabular-nums">{alerts.length} active</span>
      {/if}
    </div>
    {#if !loading}
      <a
        href="/microsoft-365/alerts"
        class="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View all alerts &rarr;
      </a>
    {/if}
  </div>

  {#if !loading && alerts.length > 0}
    <div class="flex flex-wrap items-center gap-2 px-4 py-2 border-b shrink-0">
      <div class="flex items-center gap-1">
        {#each FILTER_OPTIONS as filter}
          {@const count = filter.id === 'all' ? alerts.length : (moduleCounts.get(filter.id) ?? 0)}
          {#if filter.id === 'all' || count > 0}
            <button
              type="button"
              onclick={() => (activeFilter = filter.id)}
              class={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                activeFilter === filter.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              {filter.label}
              <span class="tabular-nums opacity-60">{count}</span>
            </button>
          {/if}
        {/each}
      </div>
      <div class="relative ml-auto w-72 max-w-full">
        <Search class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search insights"
          bind:value={searchQuery}
          class="h-8 w-full rounded-md border bg-background pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto">
    {#if loading}
      <div class="flex flex-col gap-2 p-3">
        {#each Array(4) as _}
          <div class="h-12 rounded-lg bg-muted animate-pulse"></div>
        {/each}
      </div>
    {:else if entities.length === 0}
      <div class="flex items-center justify-center h-32 text-sm text-muted-foreground">
        {searchQuery.trim() ? 'No insights match your search' : 'No active insights'}
      </div>
    {:else}
      <table class="w-full table-fixed text-sm">
        <thead class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <tr class="text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th class="w-[32%] px-4 py-2">Entity</th>
            <th class="px-3 py-2">Summary</th>
            <th class="w-24 px-3 py-2">Severity</th>
            <th class="w-20 px-3 py-2 text-right">Seen</th>
            <th class="w-24 px-4 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody>
          {#each entities as entity (entity.entityKey)}
            {@const expanded = isExpanded(entity.entityKey)}
            {@const primaryAlert = entity.alerts[0]}
            {@const modules = [...new Set(entity.alerts.map((alert) => moduleForAlert(alert).label))]}
            <tr class="group border-b hover:bg-accent/30">
              <td class="px-4 py-2 align-top">
                <button
                  type="button"
                  onclick={() => toggleEntity(entity.entityKey)}
                  class="flex w-full min-w-0 items-start gap-2 text-left"
                  aria-expanded={expanded}
                >
                  <ChevronRight
                    class={cn(
                      'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
                      expanded && 'rotate-90',
                    )}
                  />
                  <span
                    class={cn(
                      'mt-1 size-2 rounded-full shrink-0',
                      severityDot(entity.highestSeverity),
                    )}
                  ></span>
                  <span class="min-w-0">
                    <span class="block truncate font-medium">{entity.entityKey}</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                      {entity.alerts.length} {entity.alerts.length === 1 ? 'issue' : 'issues'}
                    </span>
                  </span>
                </button>
              </td>
              <td class="px-3 py-2 align-top">
                <button
                  type="button"
                  onclick={() => toggleEntity(entity.entityKey)}
                  class="block w-full text-left"
                >
                  <div class="truncate font-medium">
                    {entity.alerts.length === 1
                      ? alertTitle(primaryAlert)
                      : `${entity.alerts.length} active alerts`}
                  </div>
                  <div class="truncate text-xs text-muted-foreground">
                    {entity.alerts.length === 1
                      ? hydratedAlertMessage(primaryAlert)
                      : modules.join(', ')}
                  </div>
                </button>
              </td>
              <td class="px-3 py-2 align-top">
                <span
                  class={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium',
                    severityBadge(entity.highestSeverity),
                  )}
                >
                  {severityLabel(entity.highestSeverity)}
                </span>
              </td>
              <td class="px-3 py-2 text-right align-top text-xs text-muted-foreground tabular-nums">
                {relativeTime(primaryAlert.lastSeenAt)}
              </td>
              <td class="px-4 py-2 text-right align-top">
                {#if entity.alerts.length === 1}
                  <button
                    type="button"
                    onclick={() => openSuppress(primaryAlert)}
                    class="text-[11px] text-muted-foreground hover:text-foreground border rounded px-2 py-1 transition-colors"
                  >
                    Suppress
                  </button>
                {:else}
                  <button
                    type="button"
                    onclick={() => toggleEntity(entity.entityKey)}
                    class="text-[11px] text-muted-foreground hover:text-foreground border rounded px-2 py-1 transition-colors"
                  >
                    {expanded ? 'Hide' : 'Expand'}
                  </button>
                {/if}
              </td>
            </tr>
            {#if expanded}
              <tr class="border-b bg-muted/10">
                <td colspan="5" class="px-4 py-2">
                  <div class="ml-6 overflow-hidden rounded-md border bg-background">
                    {#each entity.alerts as alert, alertIndex (alert.id)}
                      {@const module = moduleForAlert(alert)}
                      {@const detailEntries = alertMetadataEntries(alert).slice(0, 4)}
                      <div
                        class={cn(
                          'grid gap-2 px-3 py-2 text-xs md:grid-cols-[minmax(11rem,16rem)_1fr_auto]',
                          alertIndex < entity.alerts.length - 1 && 'border-b',
                        )}
                      >
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span
                              class={cn('size-1.5 rounded-full shrink-0', severityDot(alert.severity))}
                            ></span>
                            <span class="truncate font-medium text-sm">{alertTitle(alert)}</span>
                          </div>
                          <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span>{module.label}</span>
                            <span aria-hidden="true">/</span>
                            <span>{severityLabel(alert.severity)}</span>
                          </div>
                        </div>

                        <div class="min-w-0">
                          <div class="break-words text-sm leading-snug">
                            {hydratedAlertMessage(alert)}
                          </div>
                          {#if detailEntries.length > 0}
                            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              {#each detailEntries as [key, value]}
                                <span class="min-w-0">
                                  <span>{metadataLabel(key)}:</span>
                                  <span class="font-medium text-foreground/80">
                                    {formatAlertValue(value)}
                                  </span>
                                </span>
                              {/each}
                            </div>
                          {/if}
                        </div>

                        <div class="flex items-start justify-end">
                          <button
                            type="button"
                            onclick={() => openSuppress(alert)}
                            class="shrink-0 text-[11px] text-muted-foreground hover:text-foreground border rounded px-2 py-0.5 transition-colors"
                          >
                            Suppress
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<AlertSuppress
  id={suppressId ?? ''}
  alert={suppressAlert ?? undefined}
  bind:open={suppressOpen}
  onsuppress={onalertchange}
/>
