<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { createTrpcClient } from '$lib/trpc.js';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();
  const trpc = $derived(createTrpcClient(data.token));
  const queryClient = useQueryClient();

  const alertsQuery = createQuery({
    queryKey: ['alerts', data.siteId],
    queryFn: () => trpc.alerts.list.query({ siteId: data.siteId }),
  });

  const suppressMutation = createMutation({
    mutationFn: (alertId: string) => {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      return trpc.alerts.suppress.mutate({ alertId, until });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', data.siteId] });
    },
  });

  const resolveMutation = createMutation({
    mutationFn: (alertId: string) => trpc.alerts.resolve.mutate({ alertId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', data.siteId] });
    },
  });

  const severityLabel: Record<number, string> = {
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Info',
  };
</script>

<svelte:head>
  <title>Alerts — MSPByte</title>
</svelte:head>

<h1>Alerts</h1>

{#if $alertsQuery.isLoading}
  <p>Loading alerts...</p>
{:else if $alertsQuery.isError}
  <p class="error">Failed to load alerts: {$alertsQuery.error?.message}</p>
{:else if $alertsQuery.data?.length === 0}
  <p class="empty">No alerts for this site.</p>
{:else}
  <div class="alert-list">
    {#each $alertsQuery.data ?? [] as alert}
      <div class="alert-card alert-card--{alert.status}" role="article">
        <div class="alert-header">
          <span class="severity severity--{alert.severity}">{severityLabel[alert.severity] ?? alert.severity}</span>
          <span class="status">{alert.status}</span>
        </div>
        <p class="alert-message">{alert.message}</p>
        <p class="alert-meta">Entity: {alert.entityRef ?? '—'} · First seen: {new Date(alert.firstSeen).toLocaleDateString()}</p>
        <div class="alert-actions">
          {#if alert.status === 'active'}
            <button
              onclick={() => $suppressMutation.mutate(alert.id)}
              disabled={$suppressMutation.isPending}
            >
              Suppress 7 days
            </button>
            <button
              class="resolve-btn"
              onclick={() => $resolveMutation.mutate(alert.id)}
              disabled={$resolveMutation.isPending}
            >
              Resolve
            </button>
          {:else if alert.status === 'suppressed'}
            <span class="suppressed-label">Suppressed until {alert.suppressedUntil ? new Date(alert.suppressedUntil).toLocaleDateString() : 'unknown'}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  h1 { margin-bottom: 1.5rem; }

  .alert-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .alert-card {
    background: #fff;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    border-left: 4px solid #d1d5db;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .alert-card--active { border-left-color: #dc2626; }
  .alert-card--suppressed { border-left-color: #f59e0b; opacity: 0.8; }
  .alert-card--resolved { border-left-color: #10b981; opacity: 0.6; }

  .alert-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .severity {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 99px;
    text-transform: uppercase;
  }

  .severity--1 { background: #fee2e2; color: #991b1b; }
  .severity--2 { background: #fef3c7; color: #92400e; }
  .severity--3 { background: #dbeafe; color: #1e40af; }
  .severity--4 { background: #f3f4f6; color: #4b5563; }

  .status { font-size: 0.8rem; color: #888; }

  .alert-message { margin: 0.25rem 0; font-weight: 500; }
  .alert-meta { font-size: 0.8rem; color: #888; margin: 0.25rem 0 0.75rem; }

  .alert-actions { display: flex; gap: 0.5rem; }

  button {
    padding: 0.35rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.15s;
  }

  button:hover { background: #f3f4f6; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }

  .resolve-btn { color: #10b981; border-color: #10b981; }
  .suppressed-label { font-size: 0.8rem; color: #f59e0b; }

  .empty, .error { color: #666; }
  .error { color: #dc2626; }
</style>
