<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { cn } from '$lib/utils';

  type LinkRow = {
    id: string;
    name: string | null;
    externalId: string | null;
    updatedAt: Date | string;
    [key: string]: unknown;
  };

  let {
    link,
    onclick,
    onmetrics,
  }: {
    link: LinkRow;
    onclick: (link: { id: string }) => void;
    onmetrics?: (alertCount: number, complianceFailures: number) => void;
  } = $props();

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  const alertsQuery = createQuery(() => ({
    queryKey: ['alerts.list', link.id, 'active'],
    queryFn: () => trpc.alerts.list.query({ linkId: link.id, status: 'active' }),
  }));

  const isLoading = $derived(alertsQuery.isPending);
  const alertCount = $derived(alertsQuery.data?.length ?? 0);
  // Compliance failures not available in v2 without siteId+frameworkId — show 0
  const complianceFailures = 0;

  $effect(() => {
    if (alertsQuery.isPending) return;
    const ac = alertCount;
    const cf = complianceFailures;
    untrack(() => onmetrics?.(ac, cf));
  });

  function statusColor() {
    if (alertCount > 10) return 'bg-destructive';
    if (alertCount > 0) return 'bg-warning';
    return 'bg-success';
  }

  function statusLabel() {
    if (alertCount > 10)
      return { text: 'Critical', cls: 'bg-destructive/15 text-destructive' };
    if (alertCount > 0)
      return { text: 'Warning', cls: 'bg-warning/20 text-warning' };
    return { text: 'Healthy', cls: 'bg-success/15 text-success' };
  }

  function relativeTime(ts: Date | string) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
</script>

<tr
  class="border-b transition-colors hover:bg-muted/50 cursor-pointer"
  onclick={() => onclick(link)}
>
  <td class="px-4 py-3">
    {#if isLoading}
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-muted animate-pulse"></span>
    {:else}
      <span class={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', statusColor())}></span>
    {/if}
  </td>
  <td class="px-4 py-3">
    <span class="font-medium text-sm">{link.name ?? link.externalId}</span>
  </td>
  <td class="px-4 py-3 text-center">
    {#if isLoading}
      <span class="inline-block w-8 h-4 rounded bg-muted animate-pulse"></span>
    {:else if alertCount > 0}
      <span class="inline-flex items-center justify-center min-w-6 px-1.5 py-0.5 rounded-full text-xs font-medium bg-destructive/15 text-destructive">
        {alertCount}
      </span>
    {:else}
      <span class="text-xs text-muted-foreground">—</span>
    {/if}
  </td>
  <td class="px-4 py-3 text-center">
    <span class="text-xs text-muted-foreground">—</span>
  </td>
  <td class="px-4 py-3 text-right">
    <span class="text-muted-foreground text-xs">{relativeTime(link.updatedAt)}</span>
  </td>
  <td class="px-4 py-3 text-center">
    {#if isLoading}
      <span class="inline-block w-16 h-5 rounded bg-muted animate-pulse"></span>
    {:else}
      {@const s = statusLabel()}
      <span class={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', s.cls)}>
        {s.text}
      </span>
    {/if}
  </td>
</tr>
