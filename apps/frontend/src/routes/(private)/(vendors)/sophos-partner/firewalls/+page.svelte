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

  type FirewallRow = Record<string, unknown>;

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

  const columns: DataTableColumn<FirewallRow>[] = [
    { key: 'connected', title: '', width: '32px' },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'hostname', title: 'Hostname', width: '160px', sortable: true },
    { key: 'model', title: 'Model', width: '120px', sortable: true },
    { key: 'serial_number', title: 'Serial', width: '140px' },
    { key: 'external_ip', title: 'External IP', width: '130px' },
    { key: 'firmware_version', title: 'Firmware', width: '110px' },
    { key: 'upgrade_to_version', title: 'Upgrade', width: '90px' },
    { key: 'last_change_at', title: 'Last Change', width: '130px', sortable: true },
  ];

  let drawerFirewall = $state<FirewallRow | null>(null);

  function relativeTime(ts?: string | number | null) {
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

{#if !scopeStore.currentSite}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a site to view firewalls</div>
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
      table="sophos_firewalls"
      linkId={currentLink}
      {columns}
      onrowclick={(row) => (drawerFirewall = drawerFirewall?.['id'] === row['id'] ? null : row)}
    />
  </div>
{/if}

<!-- Firewall detail sheet -->
<Sheet.Root
  open={!!drawerFirewall}
  onOpenChange={(open) => {
    if (!open) drawerFirewall = null;
  }}
>
  <Sheet.Content side="right" class="w-80 flex flex-col p-0">
    {#if drawerFirewall}
      {@const fw = drawerFirewall}
      <Sheet.Header class="p-4 border-b">
        <Sheet.Title>{String(fw['name'] ?? '—')}</Sheet.Title>
        <Sheet.Description class="flex gap-1.5 mt-1">
          <span
            class={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
              fw['connected']
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {fw['connected'] ? 'Online' : 'Offline'}
          </span>
          {#if fw['upgrade_to_version']}
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/20 text-warning"
            >
              Upgrade Available
            </span>
          {/if}
        </Sheet.Description>
      </Sheet.Header>

      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Details
        </div>
        {#each [
          { label: 'Hostname', value: fw['hostname'] },
          { label: 'Model', value: fw['model'] },
          { label: 'Serial', value: fw['serial_number'] },
          { label: 'External IP', value: fw['external_ip'] },
          { label: 'Firmware', value: fw['firmware_version'] },
          { label: 'Upgrade To', value: fw['upgrade_to_version'] },
          { label: 'Managing', value: fw['managing'] },
          { label: 'Reporting', value: fw['reporting'] },
          { label: 'Suspended', value: fw['suspended'] ? 'Yes' : null },
          { label: 'Last Change', value: relativeTime(fw['last_change_at'] as string | null) },
        ] as item}
          {#if item.value}
            <div class="flex justify-between text-xs gap-2">
              <span class="text-muted-foreground shrink-0">{item.label}</span>
              <span class="font-medium text-right font-mono">{String(item.value)}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
