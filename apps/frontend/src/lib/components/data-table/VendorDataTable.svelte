<script lang="ts" generics="TData extends Record<string, unknown>">
  import { getContext } from 'svelte';
  import { useQueryClient } from '@tanstack/svelte-query';
  import type { DataTableColumn, PaginationInput, TableFilter } from './types';
  import DataTable from './data-table.svelte';
  import type { createTrpcClient } from '$lib/trpc';

  type FilterOperatorMapped =
    | 'eq'
    | 'neq'
    | 'contains'
    | 'gt'
    | 'lt'
    | 'is_null'
    | 'is_not_null';

  interface Props {
    table: string;
    linkId?: string;
    columns: DataTableColumn<TData>[];
    defaultPageSize?: number;
    enableRowSelection?: boolean;
    onrowclick?: (row: TData) => void;
  }

  let {
    table,
    linkId,
    columns,
    defaultPageSize = 100,
    enableRowSelection = false,
    onrowclick,
  }: Props = $props();

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');
  const queryClient = useQueryClient();

  function mapOperator(op: TableFilter['operator']): FilterOperatorMapped | null {
    switch (op) {
      case 'eq': return 'eq';
      case 'neq': return 'neq';
      case 'ilike': return 'contains';
      case 'gt': return 'gt';
      case 'lt': return 'lt';
      case 'is': return 'is_null';
      case 'not.is': return 'is_not_null';
      default: return null;
    }
  }

  async function fetchData(input: PaginationInput): Promise<{ rows: TData[]; total: number }> {
    const mappedFilters = (input.filters ?? [])
      .map((f) => {
        const op = mapOperator(f.operator);
        if (!op) return null;
        return {
          column: f.field,
          operator: op,
          value: typeof f.value === 'string' ? f.value : undefined,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const searchableColumns = columns.filter((c) => c.searchable).map((c) => c.key);

    const queryInput = {
      table,
      linkId,
      page: input.page + 1,
      pageSize: input.pageSize,
      sortColumn: input.sortField,
      sortDirection: input.sortDir,
      filters: mappedFilters,
      globalSearch: input.globalSearch || undefined,
      globalSearchColumns: searchableColumns.length > 0 ? searchableColumns : undefined,
    };

    const result = await queryClient.fetchQuery({
      queryKey: ['vendor.tableData', queryInput],
      queryFn: () => trpc.vendor.tableData.query(queryInput),
    });

    return { rows: result.rows as TData[], total: result.total };
  }
</script>

<div class="flex flex-col size-full p-4">
  <DataTable
    {fetchData}
    {columns}
    {defaultPageSize}
    {enableRowSelection}
    {onrowclick}
  />
</div>
