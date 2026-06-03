<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import { cn } from '$lib/utils';
  import type { createTrpcClient } from '$lib/trpc';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import {
    boolBadgeColumn,
    nullableTextColumn,
    relativeDateColumn,
    textColumn,
  } from '$lib/components/data-table/column-defs';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import Loader from '$lib/components/transition/loader.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import { formatStringProper } from '$lib/utils/format';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  type EndpointRow = Record<string, unknown>;

  const siteLinkQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'sophos-partner', scopeStore.currentSite],
    queryFn: () =>
      trpc.integrationLinks.list.query({
        integrationId: 'sophos-partner',
        siteId: scopeStore.currentSite!,
      }),
    enabled: !!scopeStore.currentSite,
  }));

  const currentLinkId = $derived(
    scopeStore.currentSite ? (siteLinkQuery.data?.[0]?.id ?? null) : undefined
  );

  const NOW = Date.now();

  const columns: DataTableColumn<EndpointRow>[] = $derived([
    ...(!currentLinkId
      ? [
          textColumn<EndpointRow>('siteName', 'Site', undefined, {
            width: '180px',
          }),
        ]
      : []),
    textColumn<EndpointRow>('hostname', 'Hostname'),
    nullableTextColumn<EndpointRow>('platform', 'Platform', {
      width: '120px',
      sortable: true,
    }),
    {
      ...nullableTextColumn<EndpointRow>('type', 'Type', {
        width: '110px',
        sortable: true,
      }),
      filter: {
        type: 'select',
        operators: ['eq'],
        options: [
          { label: 'Computer', value: 'computer' },
          { label: 'Server', value: 'server' },
        ],
      },
    },
    boolBadgeColumn<EndpointRow>(
      'online',
      'Online',
      {
        trueLabel: 'Online',
        falseLabel: 'Offline',
        falseVariant: 'destructive',
      },
      { width: '100px' }
    ),
    boolBadgeColumn<EndpointRow>(
      'hasMdr',
      'MDR',
      {
        trueLabel: 'MDR',
        falseLabel: 'None',
      },
      { width: '90px' }
    ),
    boolBadgeColumn<EndpointRow>(
      'tamperProtectionEnabled',
      'Tamper',
      {
        trueLabel: 'Enabled',
        falseLabel: 'Disabled',
        falseVariant: 'destructive',
      },
      { width: '110px' }
    ),
    boolBadgeColumn<EndpointRow>(
      'needsUpgrade',
      'Upgrade',
      {
        trueLabel: 'Current',
        falseLabel: 'Upgrade',
        falseVariant: 'destructive',
        evaluate: (value) => !value,
      },
      { width: '110px' }
    ),
    {
      key: 'health',
      title: 'Health',
      sortable: true,
      searchable: true,
      cell: healthColumn,
    },
    relativeDateColumn<EndpointRow>('lastHeartbeatAt', 'Last Heartbeat', {
      width: '150px',
    }),
  ] as DataTableColumn<EndpointRow>[]);

  let drawerEndpoint = $state<EndpointRow | null>(null);

  function relativeTime(ts?: number | string | null) {
    if (!ts) return 'Never';
    const diff = NOW - new Date(ts).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
  }
</script>

{#snippet healthColumn({ value }: { row: EndpointRow; value: string })}
  {#if value === 'good'}
    <Badge variant="outline" class="bg-success/15 text-success border-success/30">Good</Badge>
  {:else}
    <Badge variant="outline" class="bg-warning/15 text-warning border-warning/30"
      >{formatStringProper(value)}</Badge
    >
  {/if}
{/snippet}

{#if scopeStore.currentSite && siteLinkQuery.isLoading}
  <Loader />
{:else if scopeStore.currentSite && !currentLinkId}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">No Sophos Partner integration for this site.</div>
  </div>
{:else}
  <VendorDataTable
    table="sophos_endpoints_with_site"
    linkId={currentLinkId ?? undefined}
    integrationId="sophos-partner"
    scopeColumn={false}
    {columns}
    onrowclick={(row) => (drawerEndpoint = row)}
    defaultSort={{ field: 'siteName', dir: 'asc' }}
  />
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
              ep['online'] ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
            )}
          >
            {ep['online'] ? 'Online' : 'Offline'}
          </span>
          {#if ep['hasMdr']}
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary"
            >
              MDR
            </span>
          {/if}
          {#if ep['needsUpgrade']}
            <span
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/20 text-warning"
            >
              Needs Upgrade
            </span>
          {/if}
          {#if !ep['tamperProtectionEnabled']}
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
          {#each [{ label: 'OS', value: ep['osName'] }, { label: 'Platform', value: ep['platform'] }, { label: 'Type', value: ep['type'] }, { label: 'Lockdown', value: ep['lockdown'] }, { label: 'Tamper Protection', value: ep['tamperProtectionEnabled'] ? 'Enabled' : 'Disabled' }, { label: 'Needs Upgrade', value: ep['needsUpgrade'] ? 'Yes' : 'No' }, { label: 'MDR Managed', value: ep['hasMdr'] ? 'Yes' : 'No' }, { label: 'Last Heartbeat', value: relativeTime(ep['lastHeartbeatAt'] as string | null) }] as item}
            <div>
              <div class="text-muted-foreground mb-0.5">{item.label}</div>
              <div
                class={cn(
                  'font-medium capitalize',
                  item.label === 'Tamper Protection' && !ep['tamperProtectionEnabled']
                    ? 'text-destructive'
                    : item.label === 'Needs Upgrade' && ep['needsUpgrade']
                      ? 'text-warning'
                      : ''
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
