<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, nullableTextColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import { cn } from '$lib/utils';
  import * as Sheet from '$lib/components/ui/sheet/index.js';

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  type RoleRow = {
    id: string;
    name: string;
    templateId: string;
    description: string | null;
    [key: string]: unknown;
  };

  const columns: DataTableColumn<RoleRow>[] = [
    textColumn<RoleRow>('name', 'Role Name'),
    {
      key: 'templateId',
      title: 'Template ID',
      sortable: false,
    },
    nullableTextColumn<RoleRow>('description', 'Description'),
  ];

  let selectedRole = $state<RoleRow | null>(null);

  const assigneesQuery = createQuery(() => ({
    queryKey: ['vendor.roleAssignees', scopeStore.currentLink, selectedRole?.id],
    queryFn: () =>
      trpc.vendor.roleAssignees.query({
        linkId: scopeStore.currentLink!,
        roleId: selectedRole!.id,
      }),
    enabled: !!selectedRole && !!scopeStore.currentLink,
  }));
</script>

{#if !scopeStore.currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a tenant to view roles</div>
    <div class="text-xs">Use the tenant selector in the navigation bar</div>
  </div>
{:else}
  <VendorDataTable
    table="m365_roles"
    {columns}
    onrowclick={(row) => (selectedRole = row as RoleRow)}
  />
{/if}

<Sheet.Root
  open={!!selectedRole}
  onOpenChange={(open) => {
    if (!open) selectedRole = null;
  }}
>
  <Sheet.Content side="right" class="w-96 flex flex-col p-0">
    {#if selectedRole}
      <Sheet.Header class="p-4 border-b">
        <Sheet.Title>{selectedRole.name}</Sheet.Title>
        <Sheet.Description class="font-mono text-xs">{selectedRole.templateId}</Sheet.Description>
      </Sheet.Header>

      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {#if selectedRole.description}
          <p class="text-xs text-muted-foreground">{selectedRole.description}</p>
        {/if}

        <div class="border-t pt-3">
          <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Assigned Users
            {#if !assigneesQuery.isPending && (assigneesQuery.data?.length ?? 0) > 0}
              <span class="ml-1 normal-case font-normal">({assigneesQuery.data!.length})</span>
            {/if}
          </div>

          {#if !scopeStore.currentLink}
            <div class="text-sm text-muted-foreground p-2">Select a tenant to see assignments</div>
          {:else if assigneesQuery.isPending}
            <div class="flex flex-col gap-2">
              {#each Array(3) as _}
                <div class="h-12 bg-muted rounded animate-pulse"></div>
              {/each}
            </div>
          {:else if (assigneesQuery.data?.length ?? 0) === 0}
            <div class="text-sm text-muted-foreground p-2">No users assigned to this role</div>
          {:else}
            <div class="flex flex-col gap-2">
              {#each assigneesQuery.data! as identity (identity.id)}
                <div class="flex items-center justify-between p-2.5 rounded-md border text-sm">
                  <div class="flex flex-col gap-0.5">
                    <span class="font-medium">{identity.name}</span>
                    <span class="text-xs text-muted-foreground">{identity.email}</span>
                  </div>
                  <span class={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                    identity.enabled ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                  )}>
                    {identity.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </Sheet.Content>
</Sheet.Root>
