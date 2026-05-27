<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { scopeStore } from '$lib/stores/scope.store.svelte';
  import VendorDataTable from '$lib/components/data-table/VendorDataTable.svelte';
  import { textColumn, boolBadgeColumn, relativeDateColumn } from '$lib/components/data-table/column-defs';
  import type { DataTableColumn } from '$lib/components/data-table/types';
  import IdentitySheet from './_identity-sheet.svelte';
  import NeedsAttention from './_needs-attention.svelte';
  import type { db } from "$lib/db";

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  type IdentityRow = {
    id: string;
    externalId: string;
    name: string;
    email: string;
    type: string;
    enabled: boolean;
    mfaEnforced: boolean;
    lastSignInAt: string | null;
    assignedLicenses: string[] | null;
    [key: string]: unknown;
  };

  const NOW = Date.now();

  // TODO: Naive, large tenants inaccurate
  // Fetch all identities for KPI/chart computations (large page size)
  const identitiesQuery = createQuery(() => ({
    queryKey: ['vendor.tableData', 'm365_identities', scopeStore.currentLink, 'all'],
    queryFn: () =>
      trpc.vendor.tableData.query({
        table: 'm365_identities',
        linkId: scopeStore.currentLink!,
        page: 1,
        pageSize: 1000,
      }),
    enabled: !!scopeStore.currentLink,
  }));

  // TODO: Naive, large tenants innacurate
  const alertsQuery = createQuery(() => ({
    queryKey: ['alerts.list', scopeStore.currentLink, 'active'],
    queryFn: () => trpc.alerts.list.query({ linkId: scopeStore.currentLink!, status: 'active', entityType: 'identity' }),
    enabled: !!scopeStore.currentLink,
  }));

  const identities = $derived((identitiesQuery.data?.rows ?? []) as IdentityRow[]);

  const alertsByEntityId = $derived.by(() => {
    const map = new Map<string, db.Alert[]>();
    for (const a of (alertsQuery.data as any ?? []) as db.Alert[]) {
      if (!a.entityId) continue;
      const list = map.get(a.entityId) ?? [];
      list.push(a);
      map.set(a.entityId, list);
    }
    return map;
  });

  const needsAttention = $derived(
    identities.filter((u) => (alertsByEntityId.get(u.id) ?? []).length > 0),
  );

  const noMfa = $derived(identities.filter((u) => u.mfaEnforced === false).length);
  const mfaPct = $derived(
    identities.length
      ? Math.round(((identities.length - noMfa) / identities.length) * 100)
      : 0,
  );

  const staleRanges = $derived.by(() => {
    const ranges = [
      { label: '< 7d', min: 0, max: 7, color: 'var(--success)' },
      { label: '7–30d', min: 7, max: 30, color: 'var(--warning)' },
      { label: '30–90d', min: 30, max: 90, color: 'oklch(0.65 0.18 40)' },
      { label: '> 90d', min: 90, max: Infinity, color: 'var(--destructive)' },
    ];
    return ranges.map((r) => {
      const count = identities.filter((u) => {
        if (!u.lastSignInAt) return r.max === Infinity;
        const days = (NOW - new Date(u.lastSignInAt).getTime()) / 86_400_000;
        return days >= r.min && days < r.max;
      }).length;
      return {
        ...r,
        count,
        pct: identities.length ? Math.round((count / identities.length) * 100) : 0,
      };
    });
  });

  // All Identities columns for VendorDataTable
  const columns: DataTableColumn<IdentityRow>[] = [
    textColumn<IdentityRow>('name', 'Name'),
    textColumn<IdentityRow>('email', 'Email'),
    {
      key: 'type',
      title: 'Type',
      sortable: true,
      filter: {
        type: 'select',
        operators: ['eq'],
        options: [
          { label: 'Member', value: 'member' },
          { label: 'Guest', value: 'guest' },
          { label: 'Service', value: 'service' },
        ],
      },
    },
    boolBadgeColumn<IdentityRow>('enabled', 'Status', {
      trueLabel: 'Enabled',
      falseLabel: 'Disabled',
      falseVariant: 'destructive',
    }),
    boolBadgeColumn<IdentityRow>('mfaEnforced', 'MFA', {
      trueLabel: 'Enforced',
      falseLabel: 'Not Enforced',
      falseVariant: 'destructive',
    }),
    relativeDateColumn<IdentityRow>('lastSignInAt', 'Last Sign-in'),
  ];

  let viewAll = $state(false);
  let selectedIdentity = $state<IdentityRow | null>(null);

  const identityAlerts = $derived.by((): db.Alert[] => {
    if (!selectedIdentity) return [];
    return alertsByEntityId.get(selectedIdentity.id) ?? [];
  });

  function openDrawer(identity: IdentityRow) {
    selectedIdentity = identity;
  }
</script>

{#if !scopeStore.currentLink}
  <div class="flex flex-col items-center justify-center size-full gap-2 text-muted-foreground">
    <div class="text-sm font-medium">Select a tenant to view identities</div>
    <div class="text-xs">Use the tenant selector in the navigation bar</div>
  </div>
{:else if viewAll}
  <!-- All Identities view -->
  <div class="flex flex-col size-full overflow-hidden">
    <div class="flex items-center gap-3 px-4 py-3 border-b shrink-0">
      <button
        onclick={() => (viewAll = false)}
        class="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Needs Attention
      </button>
    </div>
    <div class="flex-1 overflow-hidden">
      <VendorDataTable
        table="m365_identities"
        linkId={scopeStore.currentLink}
        {columns}
        onrowclick={(row) => openDrawer(row as IdentityRow)}
      />
    </div>
  </div>
{:else}
  <!-- Needs Attention view -->
  <NeedsAttention
    {identities}
    loading={identitiesQuery.isPending}
    {needsAttention}
    {alertsByEntityId}
    alertsLoading={alertsQuery.isPending}
    alertCount={alertsQuery.data?.length ?? 0}
    {mfaPct}
    {noMfa}
    {staleRanges}
    onviewall={() => (viewAll = true)}
    onrowclick={openDrawer}
  />
{/if}

<IdentitySheet
  identity={selectedIdentity}
  alerts={identityAlerts}
  onclose={() => (selectedIdentity = null)}
/>
