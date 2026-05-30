<script lang="ts" generics="TData">
  import { untrack } from 'svelte';
  import type { DataTableProps, TableFilter, TableView, PaginationInput, RowAction } from './types';
  import { cn } from '$lib/utils';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Table from '$lib/components/ui/table';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
  import DataTableToolbar from './data-table-toolbar.svelte';
  import DataTablePagination from './data-table-pagination.svelte';
  import { getNestedValue } from './utils/nested';
  import { exportData } from './utils/export';
  import { serializeFilters, deserializeFilters } from './utils/filters';
  import Loader from '$lib/components/transition/loader.svelte';
  import FadeIn from '$lib/components/transition/fade-in.svelte';

  let {
    fetchData: fetchDataProp,
    columns,
    enableRowSelection = false,
    enableGlobalSearch = true,
    enableFilters = true,
    enablePagination = true,
    enableColumnToggle = true,
    enableExport = true,
    enableURLState = true,
    views = [],
    rowActions = [],
    globalSearchFields,
    filterMap,
    defaultPageSize = 100,
    defaultSort,
    refreshKey = 0,
    onrowclick,
    onselectionchange,
  }: DataTableProps<TData> = $props();

  // Initialize state from URL if enabled
  function getInitialState() {
    if (enableURLState && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const rawViewId = url.searchParams.get('view') || undefined;
      const isExplicitNone = rawViewId === '_none';
      const urlViewId = isExplicitNone ? undefined : rawViewId;
      const defaultView = !isExplicitNone ? views.find((v) => v.isDefault) : undefined;
      const resolvedViewId = urlViewId ?? defaultView?.id;
      const viewFromUrl = views.find((v) => v.id === resolvedViewId);
      const urlSortField = url.searchParams.get('sortField') || undefined;
      const urlSortDir = (url.searchParams.get('sortDir') as 'asc' | 'desc') || undefined;
      return {
        page: parseInt(url.searchParams.get('page') || '0'),
        pageSize: parseInt(url.searchParams.get('size') || String(defaultPageSize)),
        globalSearch: url.searchParams.get('search') || '',
        filters: deserializeFilters(url.searchParams.get('filters') || ''),
        activeViewId: resolvedViewId,
        sortField: urlSortField ?? viewFromUrl?.sort?.field ?? defaultSort?.field,
        sortDir: urlSortDir ?? viewFromUrl?.sort?.dir ?? defaultSort?.dir,
      };
    }
    const defaultView = views.find((v) => v.isDefault);
    return {
      page: 0,
      pageSize: defaultPageSize,
      globalSearch: '',
      filters: [] as TableFilter[],
      activeViewId: defaultView?.id,
      sortField: defaultView?.sort?.field ?? defaultSort?.field,
      sortDir: defaultView?.sort?.dir ?? defaultSort?.dir,
    };
  }

  const initialState = getInitialState();

  // State
  let currentPage = $state(initialState.page);
  let pageSize = $state(initialState.pageSize);
  let globalSearch = $state(initialState.globalSearch);
  let filters = $state<TableFilter[]>(initialState.filters);
  let activeViewId = $state<string | undefined>(initialState.activeViewId);
  let sortField = $state<string | undefined>(initialState.sortField);
  let sortDir = $state<'asc' | 'desc' | undefined>(initialState.sortDir);
  let selectedRowIds = $state<Set<string>>(new Set());
  let allSelected = $state(false);
  let visibleColumnKeys = $state<Set<string>>(
    new Set(columns.filter((c) => !c.defaultHidden).map((c) => c.key))
  );
  const resolvedVisibleColumnKeys = $derived(visibleColumnKeys);

  // Data
  let data = $state<TData[]>([]);
  let total = $state(0);
  let loading = $state(false);

  // Derived state
  const activeView = $derived(views.find((v) => v.id === activeViewId));

  const viewFilters = $derived<TableFilter[]>(
    activeView?.filters.map((f) => ({ ...f, id: `view-${f.field}-${f.operator}` })) || []
  );

  const allFilters = $derived([...filters, ...viewFilters]);

  const visibleColumns = $derived(
    columns.filter((col) => !col.hidden && resolvedVisibleColumnKeys.has(col.key))
  );
  const toggleableColumns = $derived(columns.filter((c) => !c.hidden));

  const selectedRows = $derived<TData[]>(data.filter((row) => selectedRowIds.has(getRowId(row))));

  const selectionCount = $derived(allSelected ? total : selectedRows.length);

  const allRowsSelected = $derived(
    data.length > 0 && data.every((row) => selectedRowIds.has(getRowId(row)))
  );

  const someRowsSelected = $derived(
    data.some((row) => selectedRowIds.has(getRowId(row))) && !allRowsSelected
  );

  // Build PaginationInput from current state
  function buildPaginationInput(overrides: Partial<PaginationInput> = {}): PaginationInput {
    return {
      page: currentPage,
      pageSize,
      globalSearch,
      filters: allFilters,
      sortField,
      sortDir,
      ...overrides,
    };
  }

  // Get row ID (assumes 'id' field exists)
  function getRowId(row: TData): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return String((row as any).id || JSON.stringify(row));
  }

  // Fetch data using the provided callback
  async function fetchData() {
    loading = true;
    try {
      const result = await fetchDataProp(buildPaginationInput());
      data = result.rows;
      total = result.total;
    } catch (err) {
      console.error('DataTable fetch error:', err);
    }
    loading = false;
  }

  // Update URL when state changes
  function updateURL() {
    if (!enableURLState || typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (currentPage > 0) {
      url.searchParams.set('page', String(currentPage));
    } else {
      url.searchParams.delete('page');
    }

    if (pageSize !== defaultPageSize) {
      url.searchParams.set('size', String(pageSize));
    } else {
      url.searchParams.delete('size');
    }

    if (globalSearch) {
      url.searchParams.set('search', globalSearch);
    } else {
      url.searchParams.delete('search');
    }

    if (filters.length > 0) {
      url.searchParams.set('filters', serializeFilters(filters));
    } else {
      url.searchParams.delete('filters');
    }

    if (activeViewId) {
      url.searchParams.set('view', activeViewId);
    } else if (views.some((v) => v.isDefault)) {
      url.searchParams.set('view', '_none');
    } else {
      url.searchParams.delete('view');
    }

    if (sortField && sortDir) {
      url.searchParams.set('sortField', sortField);
      url.searchParams.set('sortDir', sortDir);
    } else {
      url.searchParams.delete('sortField');
      url.searchParams.delete('sortDir');
    }

    window.history.replaceState(window.history.state, '', url.toString());
  }

  // Refetch on pagination/filter/sort changes or external refresh
  $effect(() => {
    currentPage;
    pageSize;
    globalSearch;
    filters;
    activeViewId;
    sortField;
    sortDir;
    refreshKey;

    untrack(() => {
      fetchData();
      updateURL();
    });
  });

  // Selection change callback
  $effect(() => {
    if (onselectionchange) {
      onselectionchange(selectedRows);
    }
  });

  // Handlers
  function handlePageChange(newPage: number) {
    currentPage = newPage;
    allSelected = false;
  }

  function handlePageSizeChange(newSize: number) {
    pageSize = newSize;
    currentPage = 0;
    allSelected = false;
  }

  function handleGlobalSearchChange(search: string) {
    globalSearch = search;
    currentPage = 0;
    allSelected = false;
  }

  function handleAddFilter(filter: TableFilter) {
    filters = [...filters, filter];
    currentPage = 0;
    allSelected = false;
  }

  function handleRemoveFilter(filter: TableFilter) {
    filters = filters.filter((f) => f.id !== filter.id);
    allSelected = false;
  }

  function handleClearFilters() {
    filters = [];
    currentPage = 0;
    allSelected = false;
  }

  function handleViewChange(view?: TableView<TData>) {
    activeViewId = view?.id;
    currentPage = 0;
    allSelected = false;
    sortField = view?.sort?.field ?? defaultSort?.field;
    sortDir = view?.sort?.dir ?? defaultSort?.dir;
  }

  function handleSort(columnKey: string) {
    if (sortField === columnKey) {
      if (sortDir === 'asc') {
        sortDir = 'desc';
      } else if (sortDir === 'desc') {
        sortField = undefined;
        sortDir = undefined;
      }
    } else {
      sortField = columnKey;
      sortDir = 'asc';
    }
  }

  function handleToggleColumn(columnKey: string) {
    const newSet = new Set(resolvedVisibleColumnKeys);
    if (newSet.has(columnKey)) {
      newSet.delete(columnKey);
    } else {
      newSet.add(columnKey);
    }
    visibleColumnKeys = newSet;
  }

  function handleToggleAllRows(checked: boolean) {
    if (checked) {
      const newSet = new Set(selectedRowIds);
      for (const row of data) {
        newSet.add(getRowId(row));
      }
      selectedRowIds = newSet;
    } else {
      allSelected = false;
      selectedRowIds = new Set();
    }
  }

  function handleToggleRow(row: TData, checked: boolean) {
    const rowId = getRowId(row);
    const newSet = new Set(selectedRowIds);
    if (checked) {
      newSet.add(rowId);
    } else {
      allSelected = false;
      newSet.delete(rowId);
    }
    selectedRowIds = newSet;
  }

  function handleRowClick(row: TData, event: MouseEvent) {
    if (
      onrowclick &&
      !(event.target as HTMLElement).closest('input[type="checkbox"]') &&
      !(event.target as HTMLElement).closest('[data-slot="checkbox"]') &&
      !(event.target as HTMLElement).closest('button')
    ) {
      onrowclick(row);
    }
  }

  // Destructive action confirmation state
  let confirmDialogOpen = $state(false);
  let pendingAction = $state<RowAction<TData> | null>(null);
  let pendingActionRows = $state<TData[]>([]);
  let actionRunning = $state(false);

  // Export modal state
  let exportModalOpen = $state(false);
  let pendingExportFormat = $state<'csv' | 'xlsx' | null>(null);

  function handleExport(format: 'csv' | 'xlsx') {
    pendingExportFormat = format;
    exportModalOpen = true;
  }

  async function executeExport(scope: 'visible' | 'all') {
    exportModalOpen = false;
    if (!pendingExportFormat) return;
    const result = await fetchDataProp(buildPaginationInput({ page: 0, pageSize: total || 10000 }));
    const keys = scope === 'visible' ? resolvedVisibleColumnKeys : undefined;
    await exportData(result.rows, columns, pendingExportFormat, keys);
  }

  async function resolveActionRows(): Promise<TData[]> {
    if (allSelected) {
      const result = await fetchDataProp(
        buildPaginationInput({ page: 0, pageSize: total || 10000 })
      );
      return result.rows;
    }
    return selectedRows;
  }

  async function handleAction(action: RowAction<TData>) {
    const rows = await resolveActionRows();
    if (action.variant === 'destructive') {
      pendingAction = action;
      pendingActionRows = rows;
      confirmDialogOpen = true;
      return;
    }
    await action.onclick(rows, fetchData);
    allSelected = false;
    selectedRowIds = new Set();
  }

  async function confirmDestructiveAction() {
    if (!pendingAction) return;
    actionRunning = true;
    try {
      await pendingAction.onclick(pendingActionRows, fetchData);
      allSelected = false;
      selectedRowIds = new Set();
    } finally {
      actionRunning = false;
      confirmDialogOpen = false;
      pendingAction = null;
      pendingActionRows = [];
    }
  }
</script>

<div class="flex flex-col flex-1 w-full min-h-0 overflow-hidden gap-2">
  <!-- Toolbar -->
  <div>
    <DataTableToolbar
      columns={toggleableColumns}
      globalSearch={enableGlobalSearch ? globalSearch : undefined}
      onglobalsearchchange={enableGlobalSearch ? handleGlobalSearchChange : undefined}
      filters={enableFilters ? filters : undefined}
      viewFilters={enableFilters ? viewFilters : undefined}
      onaddfilter={enableFilters ? handleAddFilter : undefined}
      onremovefilter={enableFilters ? handleRemoveFilter : undefined}
      onclearfilters={enableFilters ? handleClearFilters : undefined}
      {views}
      {activeView}
      onviewchange={handleViewChange}
      visibleColumns={resolvedVisibleColumnKeys}
      ontogglecolumn={enableColumnToggle ? handleToggleColumn : undefined}
      showColumnToggle={enableColumnToggle}
      showExport={enableExport}
      onexport={enableExport ? handleExport : undefined}
    />
  </div>

  <!-- Table -->
  {#if loading}
    <Loader />
  {:else}
    <FadeIn class="flex relative size-full rounded-md border overflow-hidden bg-card/10">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            {#if enableRowSelection}
              <Table.Head class="sticky top-0 z-10 w-10 bg-background">
                <Checkbox
                  checked={allRowsSelected}
                  indeterminate={someRowsSelected}
                  onCheckedChange={handleToggleAllRows}
                />
              </Table.Head>
            {/if}
            {#each visibleColumns as column (column.key)}
              <Table.Head
                class="sticky top-0 z-10 w-10 bg-background"
                style={column.width ? `width: ${column.width}` : undefined}
              >
                {#if column.sortable}
                  <button
                    type="button"
                    class={cn(
                      'flex items-center gap-2 cursor-pointer select-none hover:text-foreground'
                    )}
                    onclick={() => handleSort(column.key)}
                  >
                    {column.title}
                    {#if sortField === column.key}
                      {#if sortDir === 'asc'}
                        <ArrowUpIcon class="h-4 w-4" />
                      {:else}
                        <ArrowDownIcon class="h-4 w-4" />
                      {/if}
                    {:else}
                      <ChevronsUpDownIcon class="h-4 w-4 opacity-30" />
                    {/if}
                  </button>
                {:else}
                  {column.title}
                {/if}
              </Table.Head>
            {/each}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#if data.length === 0}
            <Table.Row>
              <Table.Cell
                colspan={enableRowSelection ? visibleColumns.length + 1 : visibleColumns.length}
                class="h-24 text-center"
              >
                No results.
              </Table.Cell>
            </Table.Row>
          {:else}
            {#each data as row (getRowId(row))}
              {@const rowId = getRowId(row)}
              {@const isSelected = selectedRowIds.has(rowId)}
              <Table.Row
                data-state={isSelected ? 'selected' : undefined}
                class={cn(onrowclick ? 'cursor-pointer' : undefined, 'hover:bg-muted/50')}
                onclick={(e) => handleRowClick(row, e)}
              >
                {#if enableRowSelection}
                  <Table.Cell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleToggleRow(row, !!checked)}
                    />
                  </Table.Cell>
                {/if}
                {#each visibleColumns as column (column.key)}
                  {@const value = getNestedValue(row, column.key)}
                  <Table.Cell>
                    {#if column.cellComponent}
                      {@const CellComp = column.cellComponent}
                      <CellComp {value} {row} {...column.cellProps ?? {}} />
                    {:else if column.cell}
                      {@render column.cell({ row, value })}
                    {:else}
                      {value ?? ''}
                    {/if}
                  </Table.Cell>
                {/each}
              </Table.Row>
            {/each}
          {/if}
        </Table.Body>
      </Table.Root>
    </FadeIn>
  {/if}

  <!-- Bulk Actions -->
  {#if selectionCount > 0 && rowActions.length > 0}
    <div
      class="flex items-center gap-2 rounded-md border border-muted bg-muted/50 p-2 justify-between"
    >
      <span class="text-sm font-medium">
        {selectionCount} row{selectionCount !== 1 ? 's' : ''} selected
        {#if allSelected}
          <Button
            variant="ghost"
            size="sm"
            class="text-sm ml-2"
            onclick={() => {
              allSelected = false;
              selectedRowIds = new Set();
            }}>Clear selection</Button
          >
        {:else if allRowsSelected && total > data.length}
          <span class="text-muted-foreground mr-2"> of {total} total</span>
          <Button
            variant="ghost"
            size="sm"
            class="text-sm"
            onclick={() => {
              allSelected = true;
            }}>Select All {total} rows</Button
          >
        {/if}
      </span>
      <div class="flex gap-2">
        {#each rowActions as action}
          <Button
            variant={action.variant || 'outline'}
            size="sm"
            onclick={() => handleAction(action)}
            disabled={!allSelected && action.disabled ? action.disabled(selectedRows) : false}
          >
            {#if action.icon}
              {@const Icon = action.icon}
              <Icon class="h-4 w-4 mr-2" />
            {/if}
            {action.label}
          </Button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Pagination -->
  {#if enablePagination}
    <div class="mt-4">
      <DataTablePagination
        page={currentPage}
        {pageSize}
        {total}
        selectedCount={selectionCount}
        onpagechange={handlePageChange}
        onpagesizechange={handlePageSizeChange}
      />
    </div>
  {/if}

  <!-- Export modal -->
  <Dialog.Root bind:open={exportModalOpen}>
    <Dialog.Content class="max-w-sm">
      <Dialog.Header>
        <Dialog.Title>Export {pendingExportFormat?.toUpperCase()}</Dialog.Title>
        <Dialog.Description>Choose which columns to include in the export.</Dialog.Description>
      </Dialog.Header>
      <div class="flex gap-2 justify-end">
        <Button variant="outline" onclick={() => executeExport('visible')}>Visible columns</Button>
        <Button onclick={() => executeExport('all')}>All columns</Button>
      </div>
    </Dialog.Content>
  </Dialog.Root>

  <!-- Destructive action confirmation -->
  <Dialog.Root bind:open={confirmDialogOpen}>
    <Dialog.Content class="max-w-sm">
      <Dialog.Header>
        <Dialog.Title>{pendingAction?.label ?? 'Confirm'}</Dialog.Title>
        <Dialog.Description>
          Are you sure you want to {pendingAction?.label?.toLowerCase() ?? 'perform this action on'}
          {pendingActionRows.length} {pendingActionRows.length === 1 ? 'row' : 'rows'}?
          This cannot be undone.
        </Dialog.Description>
      </Dialog.Header>
      <div class="flex gap-2 justify-end">
        <Button variant="outline" onclick={() => (confirmDialogOpen = false)}>Cancel</Button>
        <Button variant="destructive" disabled={actionRunning} onclick={confirmDestructiveAction}>
          {actionRunning ? 'Processing...' : pendingAction?.label ?? 'Confirm'}
        </Button>
      </div>
    </Dialog.Content>
  </Dialog.Root>
</div>
