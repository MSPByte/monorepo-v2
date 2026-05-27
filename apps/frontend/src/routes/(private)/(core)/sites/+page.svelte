<script lang="ts">
  import { goto } from '$app/navigation';
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { INTEGRATIONS } from '@mspbyte/shared';
  import { cn } from '$lib/utils';
  import { LoaderCircle } from '@lucide/svelte';
  import { Input } from '$lib/components/ui/input/index.js';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  const sitesQuery = createQuery(() => ({
    queryKey: ['sites.list'],
    queryFn: () => trpc.sites.list.query(),
  }));

  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list'],
    queryFn: () => trpc.integrationLinks.list.query({}),
  }));

  let search = $state('');

  const linksBySite = $derived.by(() => {
    const map = new Map<string, string[]>();
    for (const link of linksQuery.data ?? []) {
      if (!link.siteId) continue;
      const existing = map.get(link.siteId) ?? [];
      if (!existing.includes(link.integrationId)) {
        existing.push(link.integrationId);
        map.set(link.siteId, existing);
      }
    }
    return map;
  });

  const filteredSites = $derived(
    (sitesQuery.data ?? []).filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
  );

  const integrationColors: Record<string, string> = {
    'microsoft-365': 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    'sophos-partner': 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20',
    'dattormm': 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
    'cove': 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  };

  function integrationColor(id: string): string {
    return integrationColors[id] ?? 'bg-muted text-muted-foreground border-border';
  }

  function relativeTime(ts: Date | string | null): string {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
</script>

<div class="flex flex-col size-full p-4 gap-3 overflow-hidden">
  <div class="flex items-center gap-2 shrink-0">
    <h2 class="text-sm font-semibold">Sites</h2>
    <div class="flex-1"></div>
    <div class="w-64">
      <Input bind:value={search} placeholder="Search sites..." class="h-8" />
    </div>
  </div>

  <div class="flex-1 overflow-hidden border rounded-lg bg-card">
    {#if sitesQuery.isLoading}
      <div class="flex h-full items-center justify-center text-muted-foreground">
        <LoaderCircle class="size-5 animate-spin" />
      </div>
    {:else}
      <div class="size-full overflow-auto">
        <table class="w-full text-sm">
          <thead class="border-b sticky top-0 bg-card">
            <tr>
              <th class="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Name</th>
              <th class="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-72">Integrations</th>
              <th class="text-right px-4 py-2 text-xs font-medium text-muted-foreground w-36">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredSites as site}
              {@const integrations = linksBySite.get(site.id) ?? []}
              <tr class="border-b hover:bg-muted/30 transition-colors cursor-pointer" onclick={() => goto(`/sites/${site.id}`)}>
                <td class="px-4 py-3 font-medium">{site.name}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    {#each integrations as intId}
                      <span class={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', integrationColor(intId))}>
                        {INTEGRATIONS[intId as keyof typeof INTEGRATIONS]?.name ?? intId}
                      </span>
                    {/each}
                    {#if integrations.length === 0}
                      <span class="text-xs text-muted-foreground">—</span>
                    {/if}
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-muted-foreground">{relativeTime(site.updatedAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
