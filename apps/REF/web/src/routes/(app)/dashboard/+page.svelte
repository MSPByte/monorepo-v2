<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { createTrpcClient } from '$lib/trpc.js';
  import SiteAlertRow from '$lib/SiteAlertRow.svelte';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
  const trpc = $derived(createTrpcClient(data.token));

  const sitesQuery = createQuery({
    queryKey: ['sites'],
    queryFn: () => trpc.sites.list.query(),
  });
</script>

<svelte:head>
  <title>Dashboard — MSPByte</title>
</svelte:head>

<h1>Dashboard</h1>

{#if $sitesQuery.isLoading}
  <p>Loading sites...</p>
{:else if $sitesQuery.isError}
  <p class="error">Failed to load sites: {$sitesQuery.error?.message}</p>
{:else if $sitesQuery.data?.length === 0}
  <p class="empty">No sites configured. <a href="/sites">Add a site</a> to get started.</p>
{:else}
  <table class="summary-table">
    <thead>
      <tr>
        <th>Site</th>
        <th>Critical Alerts</th>
        <th>Warnings</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each $sitesQuery.data ?? [] as site (site.id)}
        <SiteAlertRow siteId={site.id} siteName={site.name} {trpc} />
      {/each}
    </tbody>
  </table>
{/if}

<style>
  h1 {
    margin-bottom: 1.5rem;
  }

  .summary-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .summary-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    background: #f0f2f5;
    font-weight: 600;
    font-size: 0.85rem;
    color: #555;
    text-transform: uppercase;
    border-bottom: 1px solid #eee;
  }

  .summary-table a {
    color: #2563eb;
    text-decoration: none;
  }

  .empty {
    color: #666;
  }

  .error {
    color: #dc2626;
  }
</style>
