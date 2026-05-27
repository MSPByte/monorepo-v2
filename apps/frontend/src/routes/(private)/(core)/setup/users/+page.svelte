<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { DataTable } from '$lib/components/data-table';
  import type { DataTableColumn, PaginationInput } from '$lib/components/data-table/types';

  // TODO: Initial load shows nothing
  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  const usersQuery = createQuery(() => ({
    queryKey: ['users.list'],
    queryFn: () => trpc.users.list.query(),
  }));

  type UserRow = {
    id: string;
    name: string | null;
    email: string;
    role: string;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<UserRow>[] = [
    { key: 'name', title: 'Name', sortable: true, searchable: true },
    { key: 'email', title: 'Email', sortable: true, searchable: true },
    { key: 'role', title: 'Role', sortable: true },
  ];

  function fetchData(opts: PaginationInput): Promise<{ rows: UserRow[]; total: number }> {
    const raw = usersQuery.data ?? [];
    const rows: UserRow[] = raw.map((u) => ({
      id: u.id,
      name: u.name ?? null,
      email: u.email,
      role: u.role?.name ?? '—',
    }));

    const search = opts.globalSearch.toLowerCase();
    const filtered = search
      ? rows.filter(
          (r) =>
            (r.name ?? '').toLowerCase().includes(search) ||
            r.email.toLowerCase().includes(search) ||
            r.role.toLowerCase().includes(search),
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
    return Promise.resolve({ rows: sorted.slice(start, start + opts.pageSize), total: sorted.length });
  }
</script>

<div class="flex size-full p-4 overflow-hidden">
  <DataTable
    {columns}
    {fetchData}
    enableGlobalSearch
    enableFilters={false}
    enableExport={false}
    enableURLState={false}
    defaultPageSize={50}
  />
</div>
