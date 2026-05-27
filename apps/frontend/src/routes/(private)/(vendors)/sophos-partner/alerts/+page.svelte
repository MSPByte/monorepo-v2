<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { cn } from '$lib/utils';
  import { ALERT_DEFINITIONS } from '@mspbyte/shared';
  import type { createTrpcClient } from '$lib/trpc';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  const alertsQuery = createQuery(() => ({
    queryKey: ['alerts.list', 'sophos-partner', scopeStore.currentSite, scopeStore.currentLink],
    queryFn: () =>
      trpc.alerts.list.query({
        ...(scopeStore.currentSite ? { siteId: scopeStore.currentSite } : {}),
        ...(scopeStore.currentLink ? { linkId: scopeStore.currentLink } : {}),
        status: 'active',
      }),
  }));

  const alerts = $derived(alertsQuery.data ?? []);

  function severityLabel(severity: number) {
    if (severity >= 3) return { text: 'High', cls: 'bg-destructive/15 text-destructive' };
    if (severity >= 2) return { text: 'Medium', cls: 'bg-warning/20 text-warning' };
    if (severity >= 1) return { text: 'Low', cls: 'bg-primary/15 text-primary' };
    return { text: 'Info', cls: 'bg-muted text-muted-foreground' };
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

  function getDefinitionName(definitionId: string | null | undefined) {
    if (!definitionId) return 'Unknown Alert';
    return ALERT_DEFINITIONS[definitionId]?.name ?? definitionId;
  }
</script>

<div class="flex flex-col size-full overflow-hidden">
  <div class="flex items-center justify-between px-4 py-3 border-b shrink-0">
    <div class="text-sm font-semibold">Alerts</div>
    {#if alertsQuery.isLoading}
      <div class="text-xs text-muted-foreground">Loading…</div>
    {:else}
      <div class="text-xs text-muted-foreground">{alerts.length} active</div>
    {/if}
  </div>

  {#if alertsQuery.isLoading}
    <div class="flex items-center justify-center flex-1 text-sm text-muted-foreground">
      Loading…
    </div>
  {:else if alerts.length === 0}
    <div class="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
      <div class="text-sm">No active alerts.</div>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b bg-muted/40">
            <th
              class="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Severity
            </th>
            <th
              class="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Definition
            </th>
            <th
              class="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Message
            </th>
            <th
              class="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Status
            </th>
            <th
              class="text-right px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Last Seen
            </th>
          </tr>
        </thead>
        <tbody>
          {#each alerts as alert}
            {@const sev = severityLabel(alert.severity)}
            <tr class="border-b hover:bg-muted/30 transition-colors">
              <td class="px-4 py-2.5">
                <span
                  class={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    sev.cls,
                  )}
                >
                  {sev.text}
                </span>
              </td>
              <td class="px-4 py-2.5 font-medium">
                {getDefinitionName(alert.definitionId)}
              </td>
              <td class="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                {alert.message}
              </td>
              <td class="px-4 py-2.5">
                <span
                  class={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    alert.status === 'active'
                      ? 'bg-destructive/15 text-destructive'
                      : alert.status === 'suppressed'
                        ? 'bg-warning/20 text-warning'
                        : 'bg-success/15 text-success',
                  )}
                >
                  {alert.status}
                </span>
              </td>
              <td class="px-4 py-2.5 text-right text-xs text-muted-foreground">
                {relativeTime(alert.lastSeenAt)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
