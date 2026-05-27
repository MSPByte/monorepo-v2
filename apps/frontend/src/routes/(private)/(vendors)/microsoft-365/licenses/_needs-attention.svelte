<script lang="ts">
  import { cn } from '$lib/utils';

  type LicenseRow = {
    id: string;
    externalId: string;
    friendlyName: string | null;
    skuPartNumber: string;
    totalUnits: number;
    consumedUnits: number;
    warningUnits: number;
    enabled: boolean;
    [key: string]: unknown;
  };

  type Insight = {
    type: 'Waste' | 'Full' | 'Expiring';
    sku: string;
    detail: string;
    variant: 'destructive' | 'warning';
    license: LicenseRow;
  };

  interface Props {
    licenses: LicenseRow[];
    loading: boolean;
    totalSeats: number;
    unusedSeats: number;
    expiringSoon: number;
    insights: Insight[];
    onviewall: () => void;
    onrowclick: (license: LicenseRow) => void;
  }

  let { licenses, loading, totalSeats, unusedSeats, expiringSoon, insights, onviewall, onrowclick }: Props = $props();

  function utilColor(pct: number) {
    if (pct < 50) return 'var(--warning)';
    if (pct > 90) return 'var(--success)';
    return 'var(--primary)';
  }
</script>

<div class="flex flex-col size-full overflow-hidden relative">
  <!-- KPI strip -->
  <div class="grid grid-cols-4 gap-3 p-4 border-b shrink-0">
    <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Licensed</div>
      <div class="text-3xl font-bold tabular-nums">{loading ? '—' : totalSeats}</div>
      <div class="text-xs text-muted-foreground">{licenses.length} SKUs</div>
    </div>
    <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unused Seats</div>
      <div class="text-3xl font-bold tabular-nums text-destructive">{loading ? '—' : unusedSeats}</div>
      <div class="text-xs text-muted-foreground">potential waste</div>
    </div>
    <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SKUs</div>
      <div class="text-3xl font-bold tabular-nums">{loading ? '—' : licenses.length}</div>
      <div class="text-xs text-muted-foreground">license types</div>
    </div>
    <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expiring Soon</div>
      <div class="text-3xl font-bold tabular-nums text-warning">{loading ? '—' : expiringSoon}</div>
      <div class="text-xs text-muted-foreground">within 30 days</div>
    </div>
  </div>

  <div class="flex flex-1 overflow-hidden">
    <!-- Left: SKU utilization -->
    <div class="w-64 shrink-0 border-r p-4 overflow-y-auto">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">SKU Utilization</div>
      {#if loading}
        <div class="flex flex-col gap-4">
          {#each Array(5) as _}
            <div class="h-8 bg-muted rounded animate-pulse"></div>
          {/each}
        </div>
      {:else if licenses.length === 0}
        <div class="text-xs text-muted-foreground">No licenses found</div>
      {:else}
        <div class="flex flex-col gap-4">
          {#each licenses as lic (lic.id)}
            {@const pct = lic.totalUnits > 0 ? Math.round((lic.consumedUnits / lic.totalUnits) * 100) : 0}
            {@const color = utilColor(pct)}
            <button
              onclick={() => onrowclick(lic)}
              class="text-left hover:bg-accent/40 rounded-md p-1.5 -mx-1.5 transition-colors"
            >
              <div class="flex justify-between text-xs mb-1.5">
                <span class="text-foreground truncate max-w-36" title={lic.friendlyName || lic.skuPartNumber}>
                  {lic.friendlyName || lic.skuPartNumber}
                </span>
                <span class="shrink-0 ml-1" style="color:{color}">{lic.consumedUnits}/{lic.totalUnits}</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-border overflow-hidden">
                <div style="width:{pct}%;background:{color};height:100%;border-radius:9999px;transition:width 0.4s"></div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right: Flagged insights -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm">Flagged Insights</span>
          {#if insights.length > 0}
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/15 text-destructive">
              {insights.length}
            </span>
          {/if}
        </div>
        <button
          onclick={onviewall}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all {licenses.length} licenses →
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        {#if loading}
          {#each Array(3) as _}
            <div class="px-4 py-3.5 border-b">
              <div class="h-4 w-48 bg-muted rounded animate-pulse mb-1.5"></div>
              <div class="h-3 w-64 bg-muted rounded animate-pulse opacity-60"></div>
            </div>
          {/each}
        {:else if insights.length === 0}
          <div class="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <div class="text-sm">No license issues detected</div>
          </div>
        {:else}
          {#each insights as insight, i (i)}
            <button
              class="w-full text-left flex items-start gap-3 px-4 py-3.5 border-b hover:bg-accent/40 transition-colors"
              onclick={() => onrowclick(insight.license)}
            >
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                    insight.variant === 'destructive' ? 'bg-destructive/15 text-destructive' : 'bg-warning/20 text-warning'
                  )}>
                    {insight.type}
                  </span>
                  <span class="font-medium text-sm truncate max-w-48">{insight.sku}</span>
                </div>
                <div class="text-xs text-muted-foreground">{insight.detail}</div>
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <div class="px-4 py-2.5 border-t text-xs text-muted-foreground shrink-0">
        {totalSeats} total seats across {licenses.length} SKUs
      </div>
    </div>
  </div>
</div>
