<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { createTrpcClient } from '$lib/trpc';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
  const trpc = createTrpcClient(data.token);

  const frameworksQuery = createQuery({
    queryKey: ['frameworks', data.siteId],
    queryFn: () => trpc.compliance.frameworks.query({ siteId: data.siteId }),
  });

  let selectedFrameworkId = $state<string | null>(null);

  $effect(() => {
    if ($frameworksQuery.data?.length && !selectedFrameworkId) {
      selectedFrameworkId = $frameworksQuery.data[0].id;
    }
  });

  const resultsQuery = createQuery({
    queryKey: () => ['compliance-results', data.siteId, selectedFrameworkId],
    queryFn: () =>
      trpc.compliance.results.query({
        siteId: data.siteId,
        frameworkId: selectedFrameworkId!,
      }),
    enabled: !!selectedFrameworkId,
  });

  const statusIcons: Record<string, string> = {
    pass: '✓',
    fail: '✗',
    suppressed: '~',
    error: '!',
  };
</script>

<svelte:head>
  <title>Compliance — MSPByte</title>
</svelte:head>

<h1>Compliance</h1>

{#if $frameworksQuery.isLoading}
  <p>Loading frameworks...</p>
{:else if $frameworksQuery.data?.length === 0}
  <p class="empty">No compliance frameworks assigned to this site.</p>
{:else}
  <div class="framework-tabs">
    {#each $frameworksQuery.data ?? [] as framework}
      <button
        class:active={selectedFrameworkId === framework.id}
        onclick={() => (selectedFrameworkId = framework.id)}
      >
        {framework.name}
      </button>
    {/each}
  </div>

  {#if $resultsQuery.isLoading}
    <p>Loading results...</p>
  {:else if $resultsQuery.data}
    <table class="results-table">
      <thead>
        <tr><th>Check</th><th>Result</th></tr>
      </thead>
      <tbody>
        {#each $resultsQuery.data as row}
          <tr>
            <td>{row.check.name}</td>
            <td>
              {#if row.result}
                <span class="result result--{row.result.status}">
                  {statusIcons[row.result.status]} {row.result.status}
                </span>
              {:else}
                <span class="result result--unknown">Not evaluated</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

<style>
  .framework-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .framework-tabs button {
    padding: 0.4rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .framework-tabs button.active {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  .results-table th, .results-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  .results-table th { background: #f0f2f5; font-size: 0.85rem; font-weight: 600; color: #555; }

  .result { font-weight: 600; font-size: 0.85rem; }
  .result--pass { color: #10b981; }
  .result--fail { color: #dc2626; }
  .result--suppressed { color: #f59e0b; }
  .result--error, .result--unknown { color: #888; }

  .empty { color: #666; }
</style>
