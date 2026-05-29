<script lang="ts">
  import { goto } from '$app/navigation';
  import { getContext } from 'svelte';
  import { useQueryClient } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { INTEGRATIONS } from '@mspbyte/shared';
  import { cn } from '$lib/utils';
  import { DataTable } from '$lib/components/data-table';
  import type { DataTableColumn, PaginationInput } from '$lib/components/data-table/types';
  import { textColumn } from '$lib/components/data-table/column-defs';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');
  const queryClient = useQueryClient();

  type SiteRow = {
    id: string;
    name: string;
    description: string | null;
    integrations: string[];
    updatedAt: Date | string | null;
    [key: string]: unknown;
  };

  const integrationColors: Record<string, string> = {
    'microsoft-365': 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
    'sophos-partner': 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20',
    'dattormm': 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
    'cove': 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  };

  function integrationColor(id: string): string {
    return integrationColors[id] ?? 'bg-muted text-muted-foreground border-border';
  }

  const columns = $derived([
    textColumn('name', 'Name'),
    { key: 'integrations', title: 'Integrations', cell: integrationsCell },
  ] as DataTableColumn<SiteRow>[]);

  async function fetchData(opts: PaginationInput): Promise<{ rows: SiteRow[]; total: number }> {
    const [sites, links] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: ['sites.list'],
        queryFn: () => trpc.sites.list.query(),
      }),
      queryClient.fetchQuery({
        queryKey: ['integrationLinks.list'],
        queryFn: () => trpc.integrationLinks.list.query({}),
      }),
    ]);

    const linksBySite = new Map<string, string[]>();
    for (const link of links) {
      if (!link.siteId) continue;
      const existing = linksBySite.get(link.siteId) ?? [];
      if (!existing.includes(link.integrationId)) {
        existing.push(link.integrationId);
        linksBySite.set(link.siteId, existing);
      }
    }

    const rows: SiteRow[] = sites.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      integrations: linksBySite.get(s.id) ?? [],
      updatedAt: s.updatedAt,
    }));

    const search = opts.globalSearch.toLowerCase();
    const filtered = search
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(search) ||
            r.integrations.some((intId) => {
              const label = INTEGRATIONS[intId as keyof typeof INTEGRATIONS]?.name ?? intId;
              return label.toLowerCase().includes(search);
            }),
        )
      : rows;

    const sorted = opts.sortField
      ? [...filtered].sort((a, b) => {
          const av = String(a[opts.sortField!] ?? '');
          const bv = String(b[opts.sortField!] ?? '');
          return opts.sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
        })
      : filtered;

    const start = opts.page * opts.pageSize;
    return { rows: sorted.slice(start, start + opts.pageSize), total: sorted.length };
  }
</script>

{#snippet integrationsCell({ row }: { row: SiteRow; value: unknown })}
  <div class="flex flex-wrap gap-1">
    {#each row.integrations as intId}
      <span class={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', integrationColor(intId))}>
        {INTEGRATIONS[intId as keyof typeof INTEGRATIONS]?.name ?? intId}
      </span>
    {/each}
    {#if row.integrations.length === 0}
      <span class="text-xs text-muted-foreground">—</span>
    {/if}
  </div>
{/snippet}

<div class="flex size-full p-4 overflow-hidden">
  <DataTable
    {columns}
    {fetchData}
    enableGlobalSearch
    enableFilters={false}
    enableExport={false}
    enableURLState={false}
    defaultPageSize={50}
    onrowclick={(row) => goto(`/sites/${row.id}`)}
  />
</div>
