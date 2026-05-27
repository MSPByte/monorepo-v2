<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { createTrpcClient } from '$lib/trpc.js';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
  const trpc = $derived(createTrpcClient(data.token));
  const queryClient = useQueryClient();

  let newName = $state('');
  let newSlug = $state('');
  let formError = $state('');

  const sitesQuery = createQuery({
    queryKey: ['sites'],
    queryFn: () => trpc.sites.list.query(),
  });

  const createSite = createMutation({
    mutationFn: () => trpc.sites.create.mutate({ name: newName, slug: newSlug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      newName = '';
      newSlug = '';
      formError = '';
    },
    onError: (err) => {
      formError = err.message;
    },
  });

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!newName || !newSlug) { formError = 'Name and slug are required'; return; }
    $createSite.mutate();
  }
</script>

<svelte:head>
  <title>Sites — MSPByte</title>
</svelte:head>

<h1>Sites</h1>

<form class="create-form" onsubmit={handleSubmit}>
  <h2>Add Site</h2>
  {#if formError}<p class="error">{formError}</p>{/if}
  <label>
    Name
    <input type="text" bind:value={newName} placeholder="Acme Corp" />
  </label>
  <label>
    Slug
    <input type="text" bind:value={newSlug} placeholder="acme-corp" />
  </label>
  <button type="submit" disabled={$createSite.isPending}>
    {$createSite.isPending ? 'Creating...' : 'Create Site'}
  </button>
</form>

{#if $sitesQuery.isLoading}
  <p>Loading...</p>
{:else if $sitesQuery.data?.length === 0}
  <p class="empty">No sites yet.</p>
{:else}
  <ul class="site-list">
    {#each $sitesQuery.data ?? [] as site}
      <li>
        <a href="/sites/{site.id}">{site.name}</a>
        <span class="slug">{site.slug}</span>
        <span class="status status--{site.status}">{site.status}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .create-form {
    background: #fff;
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 480px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
    font-weight: 500;
  }

  input {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    font-size: 0.95rem;
  }

  button {
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    align-self: flex-start;
  }

  button:disabled { opacity: 0.6; }

  .site-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .site-list li {
    background: #fff;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .site-list a { color: #2563eb; text-decoration: none; font-weight: 500; }
  .slug { color: #888; font-size: 0.85rem; }

  .status { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 99px; }
  .status--active { background: #d1fae5; color: #065f46; }
  .status--suspended { background: #fee2e2; color: #991b1b; }

  .error { color: #dc2626; }
  .empty { color: #666; }
</style>
