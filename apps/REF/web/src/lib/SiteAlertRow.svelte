<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import type { createTrpcClient } from '$lib/trpc.js';

  interface Props {
    siteId: string;
    siteName: string;
    trpc: ReturnType<typeof createTrpcClient>;
  }

  const { siteId, siteName, trpc }: Props = $props();
  const queryClient = useQueryClient();

  const alertsQuery = createQuery({
    queryKey: ['alerts', siteId],
    queryFn: () => trpc.alerts.list.query({ siteId }),
  });

  const suppressMutation = createMutation({
    mutationFn: ({ alertId }: { alertId: string }) => {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      return trpc.alerts.suppress.mutate({ alertId, until });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', siteId] }),
  });

  const criticalAlerts = $derived(
    $alertsQuery.data?.filter((a) => a.severity === 1 && a.status === 'active') ?? [],
  );
  const warnings = $derived(
    $alertsQuery.data?.filter((a) => a.severity > 1 && a.status === 'active') ?? [],
  );
</script>

<tr>
  <td><a href="/sites/{siteId}">{siteName}</a></td>
  <td>
    {#if $alertsQuery.isLoading}
      <span class="loading">...</span>
    {:else}
      <span class:critical={criticalAlerts.length > 0}>{criticalAlerts.length}</span>
    {/if}
  </td>
  <td>
    {#if $alertsQuery.isLoading}
      <span class="loading">...</span>
    {:else}
      {warnings.length}
    {/if}
  </td>
  <td>
    <a href="/sites/{siteId}/alerts">View Alerts</a>
    {#if criticalAlerts.length > 0}
      <button
        class="suppress-btn"
        disabled={$suppressMutation.isPending}
        onclick={() => {
          criticalAlerts.forEach((a) => suppressMutation.mutate({ alertId: a.id }));
        }}
      >
        Suppress All (7d)
      </button>
    {/if}
  </td>
</tr>

<style>
  td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #eee;
  }

  td a {
    color: #2563eb;
    text-decoration: none;
  }

  .critical {
    color: #dc2626;
    font-weight: 700;
  }

  .loading {
    color: #aaa;
  }

  .suppress-btn {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 4px;
    color: #dc2626;
    cursor: pointer;
  }

  .suppress-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
