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
    queryKey: ['integrationLinks.list', 'sophos-partner', scopeStore.currentSite],
    queryFn: () =>
      trpc.integrationLinks.list.query({
        integrationId: 'sophos-partner',
        siteId: scopeStore.currentSite!,
      }),
    enabled: !!scopeStore.currentSite,
  }));

  const currentLink = $derived(siteLinkQuery.data?.[0]?.id ?? null);

  const NOW = Date.now();

  const columns: DataTableColumn<EndpointRow>[] = [
    { key: 'hostname', title: 'Hostname', sortable: true },
    { key: 'platform', title: 'Platform', width: '110px', sortable: true },
    { key: 'type', title: 'Type', width: '100px', sortable: true },
    { key: 'online', title: 'Online', width: '90px' },
    { key: 'has_mdr', title: 'MDR', width: '80px' },
    { key: 'tamper_protection_enabled', title: 'Tamper', width: '90px' },
    { key: 'needs_upgrade', title: 'Upgrade', width: '90px' },
    { key: 'last_heartbeat_at', title: 'Last Heartbeat', width: '140px', sortable: true },
  ];

  let drawerEndpoint = $state<EndpointRow | null>(null);
  let drawerTab = $state<'Details' | 'Notes'>('Details');

  $effect(() => {
    if (drawerEndpoint) drawerTab = 'Details';
  });

  function relativeTime(ts?: number | string | null) {
    if (!ts) return 'Never';
    const diff = NOW - new Date(ts).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
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
    <div class="text-sm font-medium">No Sophos Partner integration for this site.</div>
  </div>
{:else}
  <div class="flex flex-col size-full overflow-hidden p-4">
    <VendorDataTable
      table="sophos_endpoints"
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
          {#if ep['has_mdr']}
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary"
            >
              MDR
            </span>
          {/if}
          {#if ep['needs_upgrade']}
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/20 text-warning"
            >
              Needs Upgrade
            </span>
          {/if}
          {#if !ep['tamper_protection_enabled']}
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-destructive/15 text-destructive"
            >
              Tamper Off
            </span>
          {/if}
        </Sheet.Description>
      </Sheet.Header>

      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3 text-xs">
          {#each [
            { label: 'OS', value: ep['os'] },
            { label: 'Platform', value: ep['platform'] },
            { label: 'Type', value: ep['type'] },
            { label: 'Lockdown', value: ep['lockdown'] },
            {
              label: 'Tamper Protection',
              value: ep['tamper_protection_enabled'] ? 'Enabled' : 'Disabled',
            },
            { label: 'Needs Upgrade', value: ep['needs_upgrade'] ? 'Yes' : 'No' },
            { label: 'MDR Managed', value: ep['has_mdr'] ? 'Yes' : 'No' },
            { label: 'Last Heartbeat', value: relativeTime(ep['last_heartbeat_at'] as string | null) },
          ] as item}
            <div>
              <div class="text-muted-foreground mb-0.5">{item.label}</div>
              <div
                class={cn(
                  'font-medium capitalize',
                  item.label === 'Tamper Protection' && !ep['tamper_protection_enabled']
                    ? 'text-destructive'
                    : item.label === 'Needs Upgrade' && ep['needs_upgrade']
                      ? 'text-warning'
                      : '',
                )}
              >
                {item.value ? String(item.value) : '—'}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
