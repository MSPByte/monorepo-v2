<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { cn } from '$lib/utils';

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
  import type { createTrpcClient } from '$lib/trpc';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import * as Sheet from '$lib/components/ui/sheet/index.js';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  type EndpointRow = Record<string, unknown>;

  const BACKUP_STATUS_COLORS: Record<string, string> = {
    C: 'bg-success',
    F: 'bg-destructive',
    I: 'bg-primary/60',
    W: 'bg-warning',
    N: 'bg-muted-foreground/30',
  };

  const BACKUP_STATUS_LABEL: Record<string, string> = {
    C: 'Completed',
    F: 'Failed',
    I: 'In Process',
    W: 'Warning',
    N: 'No Data',
  };

  // ── Resolve the link for this site ──────────────────────────────────────
  const siteLinkQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'cove', scopeStore.currentSite],
    queryFn: () =>
      trpc.integrationLinks.list.query({
        integrationId: 'cove',
        siteId: scopeStore.currentSite!,
      }),
    enabled: !!scopeStore.currentSite,
  }));

  const currentLink = $derived(siteLinkQuery.data?.[0]?.id ?? null);

  const columns: DataTableColumn<EndpointRow>[] = [
    { key: 'status', title: 'Status', width: '100px' },
    { key: 'endpoint_name', title: 'Endpoint', sortable: true },
    { key: 'type', title: 'Type', width: '120px', sortable: true },
    { key: 'hostname', title: 'Hostname', width: '180px', sortable: true },
    { key: 'used_storeage', title: 'Used Storage', width: '130px' },
    { key: 'selected_size', title: 'Selected Size', width: '130px' },
    { key: 'errors', title: 'Errors', width: '80px' },
  ];

  let drawerEndpoint = $state<EndpointRow | null>(null);

  const NOW = Date.now();

  function relativeTime(ts?: number | null) {
    if (!ts) return 'Never';
    const diff = NOW - ts;
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
  }

  function statusBadgeClass(status: string) {
    if (status === 'Completed') return 'bg-success/15 text-success';
    if (status === 'In Process') return 'bg-primary/15 text-primary';
    if (status.includes('Error') || status.includes('Aborted'))
      return 'bg-amber-500/20 text-amber-600';
    return 'bg-destructive/15 text-destructive';
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
    <div class="text-sm font-medium">No Cove integration for this site.</div>
  </div>
{:else}
  <div class="flex flex-col size-full overflow-hidden p-4">
    <VendorDataTable
      table="cove_endpoints"
      linkId={currentLink}
      {columns}
      onrowclick={(row) => (drawerEndpoint = row)}
    >
    </VendorDataTable>
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
        <Sheet.Title>{String(ep['endpoint_name'] ?? ep['hostname'] ?? '—')}</Sheet.Title>
        <Sheet.Description class="flex gap-1.5 flex-wrap mt-1">
          {#if ep['status']}
            <span
              class={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                statusBadgeClass(String(ep['status'])),
              )}
            >
              {String(ep['status'])}
            </span>
          {/if}
          {#if ep['type']}
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground"
            >
              {String(ep['type'])}
            </span>
          {/if}
        </Sheet.Description>
      </Sheet.Header>

      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <!-- Storage -->
        <div>
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Storage
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded border bg-card px-3 py-2">
              <div class="text-xs text-muted-foreground">Used Storage</div>
              <div class="text-sm font-semibold mt-0.5">
                {formatBytes(Number(ep['used_storeage'] ?? 0))}
              </div>
            </div>
            <div class="rounded border bg-card px-3 py-2">
              <div class="text-xs text-muted-foreground">Selected Size</div>
              <div class="text-sm font-semibold mt-0.5">
                {formatBytes(Number(ep['selected_size'] ?? 0))}
              </div>
            </div>
          </div>
        </div>

        <!-- Backup History -->
        <div>
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Backup History
          </div>
          <div class="rounded border bg-card px-3 py-3 flex flex-col gap-3">
            {#if ep['last_28_days']}
              <div>
                <div class="text-xs text-muted-foreground mb-1.5">Last 28 Days</div>
                <div class="flex gap-px">
                  {#each String(ep['last_28_days']).split('').reverse() as code}
                    <div
                      class="h-5 w-2 rounded-sm {BACKUP_STATUS_COLORS[code] ??
                        'bg-muted-foreground/20'}"
                      title={BACKUP_STATUS_LABEL[code] ?? 'Unknown'}
                    ></div>
                  {/each}
                </div>
              </div>
            {/if}
            <div class="grid grid-cols-2 gap-2">
              <div>
                <div class="text-xs text-muted-foreground">Last Success</div>
                <div class="text-sm font-medium mt-0.5">
                  {relativeTime(ep['last_success_at'] as number | null)}
                </div>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">Errors</div>
                <div class="mt-0.5">
                  {#if Number(ep['errors'] ?? 0) > 0}
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-destructive/15 text-destructive"
                    >
                      {Number(ep['errors'])}
                    </span>
                  {:else}
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-success/15 text-success"
                    >
                      0
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Details -->
        <div>
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Details
          </div>
          <div class="flex flex-col gap-2">
            {#each [
              { label: 'Hostname', value: ep['hostname'] },
              { label: 'Profile', value: ep['profile'] },
              { label: 'Retention Policy', value: ep['retention_policy'] },
              { label: 'LSV Status', value: ep['lsv_status'] },
            ] as item}
              {#if item.value}
                <div class="rounded border bg-card px-3 py-2">
                  <div class="text-xs text-muted-foreground">{item.label}</div>
                  <div class="text-sm font-medium mt-0.5">{String(item.value)}</div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
