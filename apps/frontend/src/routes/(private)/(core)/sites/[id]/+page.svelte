<script lang="ts">
  import { page } from '$app/state';
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { LoaderCircle } from '@lucide/svelte';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');
  const siteId = $derived(page.params.id ?? '');

  const siteQuery = createQuery(() => ({
    queryKey: ['sites.get', siteId],
    queryFn: () => trpc.sites.get.query({ id: siteId }),
    enabled: !!siteId,
  }));
</script>

<div class="flex flex-col gap-6 p-6">
  <div class="flex items-center gap-2 text-sm text-muted-foreground">
    <a href="/sites" class="hover:text-foreground transition-colors">Sites</a>
    <span>/</span>
    {#if siteQuery.isLoading}
      <div class="h-4 w-24 rounded bg-muted animate-pulse"></div>
    {:else}
      <span class="text-foreground">{siteQuery.data?.name ?? 'Unknown'}</span>
    {/if}
  </div>

  {#if siteQuery.isLoading}
    <div class="h-8 w-48 rounded bg-muted animate-pulse"></div>
  {:else if siteQuery.data}
    <h1 class="text-2xl font-semibold">{siteQuery.data.name}</h1>
    <div class="rounded-lg border bg-muted/30 p-12 text-center text-muted-foreground text-sm">
      Site details coming soon
    </div>
  {:else}
    <p class="text-muted-foreground">Site not found.</p>
  {/if}
</div>
