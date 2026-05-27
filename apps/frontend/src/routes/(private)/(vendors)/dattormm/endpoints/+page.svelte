<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { cn } from '$lib/utils';
  import type { createTrpcClient } from '$lib/trpc';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import * as Sheet from '$lib/components/ui/sheet/index.js';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  type EndpointRow = Record<string, unknown>;

  // ── Resolve the link for this site ──────────────────────────────────────
  const siteLinkQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'dattormm', scopeStore.currentSite],
    queryFn: () =>
      trpc.integrationLinks.list.query({
        integrationId: 'dattormm',
        siteId: scopeStore.currentSite!,
      }),
    enabled: !!scopeStore.currentSite,
  }));

  const currentLink = $derived(siteLinkQuery.data?.[0]?.id ?? null);

  const columns: DataTableColumn<EndpointRow>[] = [
    { key: 'online', title: 'Status', width: '80px' },
    { key: 'hostname', title: 'Hostname', sortable: true },
    { key: 'category', title: 'Category', width: '120px', sortable: true },
    { key: 'os', title: 'OS', width: '160px', sortable: true },
    { key: 'ip_address', title: 'IP Address', width: '130px' },
    { key: 'ext_address', title: 'External IP', width: '130px' },
    { key: 'last_heartbeat_at', title: 'Last Heartbeat', width: '140px', sortable: true },
    { key: 'last_reboot_at', title: 'Last Reboot', width: '130px', sortable: true },
  ];

  let drawerEndpoint = $state<EndpointRow | null>(null);
  let activeTab = $state<'Details' | 'UDFs'>('Details');

  $effect(() => {
    if (drawerEndpoint) activeTab = 'Details';
  });

  const udfEntries = $derived.by(() => {
    const udfs = drawerEndpoint?.['udfs'];
    if (!udfs || typeof udfs !== 'object') return [];
    return Object.entries(udfs as Record<string, unknown>).filter(([, v]) => v != null && v !== '');
  });

  function absoluteDate(ts?: number | string | null) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

{#if !scopeStore.currentSite}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a site to view endpoints</div>
    <div class="text-xs">Use the site selector in the navigation bar</div>
  </div>
{:else if siteLinkQuery.isLoading}
  <div class="flex items-center justify-center size-full text-sm text-muted-foreground">
    Loading…
  </div>
{:else if !currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">No DattoRMM integration for this site.</div>
  </div>
{:else}
  <div class="flex flex-col size-full overflow-hidden p-4">
    <VendorDataTable
      table="datto_endpoints"
      tenantId={scopeStore.currentSite}
      linkId={currentLink}
      {columns}
      onrowclick={(row) => (drawerEndpoint = row)}
    />
  </div>
{/if}

<!-- Endpoint detail sheet -->
<Sheet.Root
  open={!!drawerEndpoint}
  onOpenChange={(open) => {
    if (!open) drawerEndpoint = null;
  }}
>
  <Sheet.Content side="right" class="w-96 flex flex-col p-0">
    {#if drawerEndpoint}
      {@const ep = drawerEndpoint}
      <Sheet.Header class="p-4 border-b">
        <Sheet.Title>{String(ep['hostname'] ?? '—')}</Sheet.Title>
        <Sheet.Description class="flex gap-1.5 flex-wrap mt-1">
          <span
            class={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
              ep['online']
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {ep['online'] ? 'Online' : 'Offline'}
          </span>
          {#if ep['category']}
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground capitalize"
            >
              {String(ep['category'])}
            </span>
          {/if}
        </Sheet.Description>
      </Sheet.Header>

      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div class="flex gap-1 border-b">
          {#each (['Details', 'UDFs'] as const) as tab}
            <button
              onclick={() => (activeTab = tab)}
              class={cn(
                'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
            </button>
          {/each}
        </div>

        {#if activeTab === 'Details'}
          <div class="grid grid-cols-2 gap-3 text-xs">
            {#each [
              { label: 'OS', value: ep['os'] },
              { label: 'Category', value: ep['category'] },
              { label: 'IP Address', value: ep['ip_address'] },
              { label: 'External IP', value: ep['ext_address'] },
              { label: 'Last Heartbeat', value: absoluteDate(ep['last_heartbeat_at'] as string | null) },
              { label: 'Last Reboot', value: absoluteDate(ep['last_reboot_at'] as string | null) },
            ] as item}
              <div>
                <div class="text-muted-foreground mb-0.5">{item.label}</div>
                <div class="font-medium font-mono">{item.value ? String(item.value) : '—'}</div>
              </div>
            {/each}
          </div>
        {:else if activeTab === 'UDFs'}
          {#if udfEntries.length === 0}
            <div class="text-sm text-muted-foreground">No user-defined fields.</div>
          {:else}
            <div class="flex flex-col gap-2">
              {#each udfEntries as [key, value]}
                <div class="rounded border bg-card px-3 py-2">
                  <div class="text-xs text-muted-foreground">{key}</div>
                  <div class="text-sm font-medium mt-0.5 font-mono break-all">{String(value)}</div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
