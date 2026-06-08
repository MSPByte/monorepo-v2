<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { Play, RefreshCw } from '@lucide/svelte';
  import { INTEGRATIONS } from '@mspbyte/shared';
  import type { ProviderFacet } from '@mspbyte/shared';
  import type { createTrpcClient } from '$lib/trpc';
  import { Button } from '$lib/components/ui/button';
  import SingleSelect from '$lib/components/single-select.svelte';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  let providerId = $state('microsoft-365');
  let linkId = $state('');
  let selectedFacets = $state<Record<string, boolean>>({});
  let includeDependencies = $state(true);
  let force = $state(true);
  let queueing = $state(false);
  let result = $state<{ syncRunId: string; ingestRunId: string; facets: ProviderFacet[] } | null>(
    null
  );
  let error = $state<string | null>(null);

  const providers = $derived(
    Object.values(INTEGRATIONS).filter((i) => i.supportedFacets.length > 0)
  );
  const provider = $derived(INTEGRATIONS[providerId as keyof typeof INTEGRATIONS]);
  const facets = $derived(provider?.supportedFacets.map((f) => f.facet) ?? []);
  const chosenFacets = $derived(facets.filter((facet) => selectedFacets[facet]));

  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', providerId],
    queryFn: () =>
      trpc.integrationLinks.list.query({ integrationId: providerId, status: 'active' }),
  }));

  const statusQuery = createQuery(() => ({
    queryKey: ['pipeline.syncStatus', linkId],
    enabled: Boolean(linkId),
    queryFn: () => trpc.pipeline.syncStatus.query({ linkId }),
  }));

  $effect(() => {
    const links = linksQuery.data ?? [];
    if (!links.some((link) => link.id === linkId)) {
      linkId = links[0]?.id ?? '';
    }
  });

  function toggleFacet(facet: ProviderFacet) {
    selectedFacets = { ...selectedFacets, [facet]: !selectedFacets[facet] };
  }

  function selectAll() {
    selectedFacets = Object.fromEntries(facets.map((facet) => [facet, true]));
  }

  function clearFacets() {
    selectedFacets = {};
  }

  async function queueRun() {
    if (!linkId || chosenFacets.length === 0 || queueing) return;

    queueing = true;
    result = null;
    error = null;
    try {
      result = await trpc.pipeline.replay.mutate({
        linkId,
        mode: 'full',
        facets: chosenFacets,
        includeDependencies,
        force,
      });
      await statusQuery.refetch();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      queueing = false;
    }
  }

  function formatDate(value: Date | string | null | undefined) {
    if (!value) return 'Never';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }
</script>

<div class="flex size-full flex-col gap-4 overflow-auto p-4">
  <div class="grid gap-4 xl:grid-cols-[360px_1fr]">
    <section class="rounded-lg border bg-background p-4">
      <div class="grid gap-4">
        <label class="grid gap-1 text-sm font-medium">
          Integration
          <SingleSelect
            options={providers.map((p) => ({ label: p.name, value: p.id }))}
            bind:selected={providerId}
          />
        </label>

        <label class="grid gap-1 text-sm font-medium">
          Link
          <SingleSelect
            options={(linksQuery.data ?? []).map((l) => ({ label: l.name!, value: l.id }))}
            bind:selected={linkId}
          />
        </label>

        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onclick={selectAll}>All</Button>
          <Button variant="outline" size="sm" onclick={clearFacets}>Clear</Button>
          <Button
            variant="outline"
            size="sm"
            onclick={() => statusQuery.refetch()}
            disabled={!linkId}
          >
            <RefreshCw class="size-4" />
          </Button>
        </div>

        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={includeDependencies} />
          Include dependencies
        </label>

        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={force} />
          Force selected facets
        </label>

        <Button
          onclick={queueRun}
          disabled={!linkId || chosenFacets.length === 0 || queueing}
          class="gap-2"
        >
          <Play class="size-4" />
          {queueing ? 'Queueing' : 'Queue Run'}
        </Button>

        {#if result}
          <div
            class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"
          >
            Queued {result.facets.length} facets for run {result.syncRunId.slice(0, 8)}.
          </div>
        {/if}

        {#if error}
          <div
            class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        {/if}
      </div>
    </section>

    <section class="rounded-lg border bg-background p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold">Facets</h2>
        <div class="text-sm text-muted-foreground">{chosenFacets.length} selected</div>
      </div>

      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {#each facets as facet}
          <button
            type="button"
            class="flex min-h-10 items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted {selectedFacets[
              facet
            ]
              ? 'border-primary bg-primary/10'
              : ''}"
            onclick={() => toggleFacet(facet)}
          >
            <span class="break-all">{facet}</span>
            <input type="checkbox" checked={selectedFacets[facet] ?? false} readonly />
          </button>
        {/each}
      </div>
    </section>
  </div>

  <section class="rounded-lg border bg-background">
    <div class="border-b p-4">
      <h2 class="text-base font-semibold">Sync Context</h2>
    </div>
    <div class="overflow-auto">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/50 text-left">
          <tr>
            <th class="px-4 py-2 font-medium">Facet</th>
            <th class="px-4 py-2 font-medium">Last Success</th>
            <th class="px-4 py-2 font-medium">Failures</th>
            <th class="px-4 py-2 font-medium">Last Error</th>
          </tr>
        </thead>
        <tbody>
          {#each statusQuery.data?.contexts ?? [] as context}
            <tr class="border-b last:border-0">
              <td class="px-4 py-2">{context.type}</td>
              <td class="px-4 py-2">{formatDate(context.lastSuccessAt)}</td>
              <td class="px-4 py-2">{context.consecutiveFailures}</td>
              <td class="max-w-lg truncate px-4 py-2">{context.lastErrorMessage ?? ''}</td>
            </tr>
          {:else}
            <tr>
              <td class="px-4 py-6 text-muted-foreground" colspan="4"
                >No sync context for this link.</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</div>
