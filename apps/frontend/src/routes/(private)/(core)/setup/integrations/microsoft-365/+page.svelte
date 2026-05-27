<script lang="ts">
  import { getContext } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc';
  import { INTEGRATIONS, CONSENT_VERSION } from '@mspbyte/shared';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import * as Tabs from '$lib/components/ui/tabs/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Input } from '$lib/components/ui/input/index.js';
  import {
    Settings,
    TriangleAlert,
    Users,
    Globe,
    CircleCheck,
    CircleX,
    LoaderCircle,
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { toast } from 'svelte-sonner';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.store.svelte';
  import SelectedLink from './_selected-link.svelte';
  import ComplianceTab from './_compliance-tab.svelte';
  // Use looser types to accommodate tRPC JSON serialization (dates become strings over HTTP)
  type Link = {
    id: string;
    integrationId: string;
    siteId: string | null;
    externalId: string | null;
    name: string | null;
    status: 'active' | 'error' | 'disabled' | null;
    disposition: 'managed' | 'third_party' | 'not_managed' | null;
    note: string | null;
    meta?: unknown;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  type Site = {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  };

  // MS_CAPABILITIES not in v2 shared — define locally
  const MS_CAPABILITIES: Record<string, { label: string; description: string }> = {
    signInActivity: {
      label: 'Sign-in Activity',
      description: 'Last sign-in timestamps per user',
    },
    conditionalAccess: {
      label: 'Conditional Access',
      description: 'Conditional Access policy retrieval',
    },
    identityProtection: {
      label: 'Identity Protection',
      description: 'Risky user detection via Azure AD Identity Protection',
    },
  };

  const integration = INTEGRATIONS['microsoft-365'];
  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  const integrationQuery = createQuery(() => ({
    queryKey: ['integrations.get', 'microsoft-365'],
    queryFn: () => trpc.integrations.get.query({ id: 'microsoft-365' }),
  }));

  const linksQuery = createQuery(() => ({
    queryKey: ['integrationLinks.list', 'microsoft-365'],
    queryFn: () => trpc.integrationLinks.list.query({ integrationId: 'microsoft-365' }),
  }));

  const sitesQuery = createQuery(() => ({
    queryKey: ['sites.list'],
    queryFn: () => trpc.sites.list.query(),
  }));

  const dbIntegration = $derived(integrationQuery.data ?? null);
  const loading = $derived(integrationQuery.isLoading || linksQuery.isLoading);

  const tenantLinks = $derived((linksQuery.data ?? []).filter((l) => !l.siteId));
  const siteLinks = $derived((linksQuery.data ?? []).filter((l) => !!l.siteId));
  const dbSites = $derived(sitesQuery.data ?? []);

  const activeLinks = $derived(tenantLinks.filter((l) => l.status === 'active'));

  const metrics = $derived({
    total: tenantLinks.length,
    active: activeLinks.length,
    withIssues: activeLinks.filter(
      (l) => (l.meta as Record<string, unknown>)?.consentVersion !== CONSENT_VERSION
    ).length,
    totalUnmapped: activeLinks.reduce((acc, al) => {
      const mapped = siteLinks
        .filter((sl) => sl.externalId === al.externalId)
        .reduce(
          (dacc, sl) => dacc + ((sl.meta as Record<string, unknown>)?.domains as unknown[] ?? []).length,
          0
        );
      return acc + ((al.meta as Record<string, unknown>)?.domains as unknown[] ?? []).length - mapped;
    }, 0),
    isConfigured: !!(dbIntegration && !dbIntegration.deletedAt),
  });

  let selectedLinkId = $state<string | null>(null);
  let connectionSearch = $state('');
  let activeFilter = $state<'All' | 'Active' | 'Needs Consent' | 'Has Unmapped' | 'Missing Capabilities'>('All');
  let configSheetOpen = $state(false);
  let syncing = $state(false);
  let showDeleteConfirm = $state(false);

  const selectedLink = $derived(tenantLinks.find((l) => l.id === selectedLinkId) ?? null);

  const domainSiteMap = $derived.by(() => {
    const map = new Map<string, string>();
    if (!selectedLink) return map;
    for (const sl of siteLinks) {
      if (sl.externalId !== selectedLink.externalId) continue;
      const slDomains = (sl.meta as Record<string, unknown>)?.domains as string[] ?? [];
      const tlDomains = (selectedLink.meta as Record<string, unknown>)?.domains as string[] ?? [];
      for (const domain of slDomains) {
        if (!tlDomains.includes(domain)) continue;
        if (sl.siteId) map.set(domain, sl.siteId);
      }
    }
    return map;
  });

  const missingCapsCount = (link: Link): number =>
    Object.keys(MS_CAPABILITIES).filter(
      (key) =>
        ((link.meta as Record<string, unknown>)?.capabilities as Record<string, boolean> | undefined)?.[key] === false
    ).length;

  const evaluateLinkFilter = (active: typeof activeFilter, link: Link) => {
    switch (active) {
      case 'All': return true;
      case 'Has Unmapped': {
        if (link.status !== 'active') return false;
        const domainCount = siteLinks
          .filter((sl) => sl.externalId === link.externalId)
          .reduce(
            (acc, sl) => acc + ((sl.meta as Record<string, unknown>)?.domains as unknown[] ?? []).length,
            0
          );
        return domainCount < ((link.meta as Record<string, unknown>)?.domains as unknown[] ?? []).length;
      }
      case 'Active': return link.status === 'active';
      case 'Needs Consent':
        return (
          (link.meta as Record<string, unknown>)?.consentVersion !== CONSENT_VERSION &&
          link.status === 'active'
        );
      case 'Missing Capabilities':
        return link.status === 'active' && missingCapsCount(link) > 0;
      default: return true;
    }
  };

  const filteredLinks = $derived(
    tenantLinks
      .filter((l) =>
        (l.name ?? l.externalId ?? '').toLowerCase().includes(connectionSearch.toLowerCase())
      )
      .filter((l) => evaluateLinkFilter(activeFilter, l))
      .sort((a, b) => (a.name ?? '').toLowerCase().localeCompare((b.name ?? '').toLowerCase()))
  );

  // URL param toasts
  $effect(() => {
    const error = page.url.searchParams.get('error');
    const initialConsent = page.url.searchParams.get('initialConsent');
    const consentedTenant = page.url.searchParams.get('consentedTenant');

    if (initialConsent) {
      toast.info('Microsoft 365 consent successful!');
    } else if (consentedTenant) {
      const link = tenantLinks.find((l) => l.externalId === consentedTenant);
      if (link) {
        toast.info(`Successfully consented for tenant ${link.name ?? link.externalId}`);
        selectedLinkId = link.id;
      }
    } else if (error) {
      toast.error(`Failed to complete the consent flow: ${error}`);
    }

    if (error || initialConsent || consentedTenant) {
      goto('?', { replaceState: true });
    }
  });
</script>

<!-- Delete integration confirm -->
<AlertDialog.Root bind:open={showDeleteConfirm}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Microsoft 365 Integration?</AlertDialog.Title>
      <AlertDialog.Description>
        This will remove the Microsoft 365 integration from your account. All associated data
        (tenants, identities, domains) will be permanently deleted after 30 days. This action can
        be undone before that window expires.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <form
        method="POST"
        action="?/deleteIntegration"
        use:enhance={() => {
          return async ({ result }) => {
            showDeleteConfirm = false;
            if (result.type === 'redirect') goto(result.location);
          };
        }}
      >
        <AlertDialog.Action
          type="submit"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Delete Integration
        </AlertDialog.Action>
      </form>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Configuration Sheet -->
{#if authStore.isAllowed('Integrations.Write')}
  <Sheet.Root bind:open={configSheetOpen}>
    <Sheet.Portal>
      <Sheet.Overlay />
      <Sheet.Content side="right" class="w-105 flex flex-col gap-0 p-0">
        <Sheet.Header class="p-4 border-b">
          <Sheet.Title>Configure Microsoft 365</Sheet.Title>
          <Sheet.Description>Set up your M365 integration credentials.</Sheet.Description>
        </Sheet.Header>

        <div class="flex flex-col p-4 flex-1 overflow-y-auto">
          <Card.Root class="bg-primary/5 border-primary/20">
            <Card.Header class="pb-2">
              <Card.Title class="text-base">GDAP Partner Connection</Card.Title>
            </Card.Header>
            <Card.Content>
              <p class="text-sm text-muted-foreground mb-4">
                Connect MSPByte as a partner application through Microsoft's Granular Delegated
                Admin Privileges (GDAP) framework. This allows managing multiple customer tenants
                without requiring per-tenant credentials.
              </p>
              <form method="POST" action="?/initialConsent" use:enhance>
                <Button variant="outline" size="sm" type="submit">Connect MSPByte</Button>
              </form>
            </Card.Content>
          </Card.Root>
        </div>

        <Sheet.Footer class="p-4 border-t">
          {#if metrics.isConfigured}
            <Button
              variant="destructive"
              onclick={() => { configSheetOpen = false; showDeleteConfirm = true; }}
            >
              Delete Integration
            </Button>
          {/if}
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>
{/if}

<!-- Main Layout -->
<div class="flex flex-col size-full p-4 gap-4 overflow-hidden">
  <!-- Header -->
  <div class="flex items-start justify-between shrink-0">
    <div class="flex flex-col gap-0.5">
      <div class="flex items-center gap-2">
        <h1 class="text-lg font-semibold">{integration.name}</h1>
        <Badge
          variant="outline"
          class="{metrics.isConfigured
            ? 'bg-primary/15 text-primary border-primary/30'
            : 'bg-muted text-muted-foreground'} text-xs"
        >
          {metrics.isConfigured ? 'Configured' : 'Not configured'}
        </Badge>
      </div>
      <p class="text-xs text-muted-foreground">
        Manage Microsoft 365 tenant connections and compliance.
      </p>
    </div>
    <div class="flex gap-2">
      {#if authStore.isAllowed('Integrations.Write')}
        <form
          method="POST"
          action="?/gdapSync"
          use:enhance={() => {
            syncing = true;
            return async ({ result }) => {
              syncing = false;
              if (result.type === 'failure') {
                toast.error((result.data as Record<string, unknown>)?.error as string ?? 'GDAP sync failed');
              }
            };
          }}
        >
          <Button variant="outline" size="sm" type="submit" disabled={syncing} class="gap-2">
            <LoaderCircle class="size-4 {syncing ? 'animate-spin' : ''}" />
            Resync GDAP
          </Button>
        </form>
        <Button
          variant="outline"
          size="sm"
          onclick={() => (configSheetOpen = true)}
          class="gap-2"
        >
          <Settings class="size-4" />
          Configure
        </Button>
      {/if}
    </div>
  </div>

  {#if metrics.isConfigured}
    <Tabs.Root value="connections" class="flex flex-col flex-1 overflow-hidden gap-3">
      <Tabs.List class="shrink-0 w-fit">
        <Tabs.Trigger value="connections">Connections</Tabs.Trigger>
        <Tabs.Trigger value="compliance">Compliance</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="connections" class="flex flex-col flex-1 overflow-hidden gap-4 mt-0">
        <!-- Metrics strip -->
        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 shrink-0">
          <Card.Root class="p-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-muted-foreground">Total Tenants</span>
              <span class="text-2xl font-bold">{loading ? '—' : metrics.total}</span>
            </div>
          </Card.Root>
          <Card.Root class="p-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-muted-foreground">Active</span>
              <span class="text-2xl font-bold text-primary">{loading ? '—' : metrics.active}</span>
            </div>
          </Card.Root>
          <Card.Root class="p-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-muted-foreground">Needs Action</span>
              <span class="text-2xl font-bold text-warning">{loading ? '—' : metrics.withIssues}</span>
            </div>
          </Card.Root>
          <Card.Root class="p-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-muted-foreground">Unmapped</span>
              <span class="text-2xl font-bold text-destructive">{loading ? '—' : metrics.totalUnmapped}</span>
            </div>
          </Card.Root>
          <Card.Root class="p-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-muted-foreground">Config Health</span>
              {#if loading}
                <span class="text-2xl font-bold">—</span>
              {:else if metrics.isConfigured}
                <span class="text-sm font-medium text-primary flex items-center gap-1">
                  <CircleCheck class="size-4" /> Healthy
                </span>
              {:else}
                <span class="text-sm font-medium text-destructive flex items-center gap-1">
                  <CircleX class="size-4" /> Not set up
                </span>
              {/if}
            </div>
          </Card.Root>
        </div>

        {#if !loading && !metrics.isConfigured}
          <div class="flex items-center gap-3 px-4 py-3 rounded bg-warning/10 text-warning border border-warning/30 shrink-0">
            <TriangleAlert class="size-4 shrink-0" />
            <span class="text-sm">
              Microsoft 365 is not configured yet. Click <strong>Configure</strong> to set up your
              credentials.
            </span>
          </div>
        {/if}

        <!-- Search + filters -->
        <div class="flex gap-2 items-center shrink-0 w-full">
          <div class="w-80">
            <Input bind:value={connectionSearch} placeholder="Search tenants..." class="h-8" />
          </div>
          <div class="flex gap-1.5 shrink-0 flex-wrap">
            {#each ['All', 'Active', 'Needs Consent', 'Has Unmapped', 'Missing Capabilities'] as filter}
              <button
                class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                {activeFilter === filter
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/30'}"
                onclick={() => (activeFilter = filter as typeof activeFilter)}
              >
                {filter}
              </button>
            {/each}
          </div>
        </div>

        <!-- Tenant list + selected panel -->
        <div class="flex-1 overflow-hidden flex gap-4 min-h-0">
          <div
            class="flex flex-col overflow-hidden gap-4 transition-all duration-200 {selectedLinkId
              ? 'w-96'
              : 'flex-1'}"
          >
            <div class="flex-1 overflow-y-auto pr-1">
              {#if loading}
                <div class="flex items-center justify-center h-full text-muted-foreground">
                  <LoaderCircle class="size-5 animate-spin" />
                </div>
              {:else if filteredLinks.length === 0}
                <div class="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <Globe class="size-8 opacity-40" />
                  <span class="text-sm">No tenants found</span>
                </div>
              {:else}
                <div
                  class="grid gap-3 {selectedLinkId
                    ? 'grid-cols-1'
                    : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}"
                >
                  {#each filteredLinks as link (link.id)}
                    {@const missing = missingCapsCount(link)}
                    <button
                      class="text-left w-full"
                      onclick={() => (selectedLinkId = selectedLinkId === link.id ? null : link.id)}
                    >
                      <Card.Root
                        class="p-3 cursor-pointer hover:border-primary/50 transition-colors h-24 {selectedLinkId === link.id
                          ? 'border-primary bg-primary/10'
                          : 'bg-card/70'}"
                      >
                        <div class="flex flex-col h-full gap-2 justify-between">
                          <div class="flex items-start justify-between gap-2">
                            <span class="font-medium text-sm leading-tight">
                              {link.name ?? link.externalId}
                            </span>
                            <Badge
                              class="text-xs shrink-0 {link.status === 'active'
                                ? 'bg-primary/15 text-primary border-primary/30'
                                : 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30'}"
                              variant="outline"
                            >
                              {link.status?.toUpperCase() ?? 'UNKNOWN'}
                            </Badge>
                          </div>
                          <div class="flex items-center gap-3 text-xs text-muted-foreground">
                            <span class="flex items-center gap-1">
                              <Globe class="size-3" />
                              {((link.meta as Record<string, unknown>)?.domains as unknown[] ?? []).length} domains
                            </span>
                            <span class="flex items-center gap-1">
                              <Users class="size-3" />
                              {(link.meta as Record<string, unknown>)?.userCount ?? 0} users
                            </span>
                            {#if missing > 0}
                              <span class="flex items-center gap-1 text-warning">
                                <TriangleAlert class="size-3 text-amber-500" />
                                {missing} missing
                              </span>
                            {/if}
                          </div>
                        </div>
                      </Card.Root>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          {#if selectedLink}
            <SelectedLink
              {selectedLink}
              {domainSiteMap}
              {dbSites}
              {siteLinks}
              deselect={() => (selectedLinkId = null)}
            />
          {/if}
        </div>
      </Tabs.Content>

      <Tabs.Content value="compliance" class="flex-1 overflow-hidden mt-0">
        <ComplianceTab links={(linksQuery.data ?? []) as Link[]} />
      </Tabs.Content>
    </Tabs.Root>
  {:else if loading}
    <div class="flex items-center justify-center flex-1 text-muted-foreground">
      <LoaderCircle class="size-5 animate-spin" />
    </div>
  {:else}
    <div class="flex flex-col size-full justify-center items-center">
      <div class="flex items-center gap-3 px-4 py-3 w-fit rounded bg-warning/10 text-warning border border-warning/30">
        <TriangleAlert class="size-4" />
        <span class="text-sm">
          Microsoft 365 is not configured yet. Click <strong>Configure</strong> to set up your
          credentials.
        </span>
      </div>
    </div>
  {/if}
</div>
