<script lang="ts">
  import { cn } from '$lib/utils';
  import { ALERT_DEFINITIONS, AlertSeverity } from '@mspbyte/shared';
  import AlertBadge from "$lib/components/alerts/alert-badge.svelte";
  import type { db } from "$lib/db";

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

  interface StaleRange {
    label: string;
    color: string;
    count: number;
    pct: number;
  }

  interface Props {
    identities: IdentityRow[];
    loading: boolean;
    needsAttention: IdentityRow[];
    alertsByEntityId: Map<string, db.Alert[]>;
    alertsLoading: boolean;
    alertCount: number;
    mfaPct: number;
    noMfa: number;
    staleRanges: StaleRange[];
    onviewall: () => void;
    onrowclick: (identity: IdentityRow) => void;
  }

  let {
    identities,
    loading,
    needsAttention,
    alertsByEntityId,
    alertsLoading,
    alertCount,
    mfaPct,
    noMfa,
    staleRanges,
    onviewall,
    onrowclick,
  }: Props = $props();

  type SeverityFilter = 'High' | 'Medium' | 'Low' | 'Critical';
  let activeFilter = $state<SeverityFilter | null>(null);

  const filterToSeverity: Record<SeverityFilter, number> = {
    High: AlertSeverity.High,
    Medium: AlertSeverity.Medium,
    Low: AlertSeverity.Low,
    Critical: AlertSeverity.Critical,
  };

  const filteredAttention = $derived.by(() => {
    if (!activeFilter) return needsAttention;
    const sv = filterToSeverity[activeFilter];
    return needsAttention.filter((u) =>
      (alertsByEntityId.get(u.id) ?? []).some((a) => a.severity === sv),
    );
  });

  function severityClass(sv: number) {
    if (sv >= AlertSeverity.Critical) return 'bg-destructive/15 text-destructive'; 
    if (sv >= AlertSeverity.High) return 'bg-warning/20 text-warning';
    if (sv >= AlertSeverity.Medium) return 'bg-primary/10 text-primary';           
    return 'bg-muted text-muted-foreground';                     
  }
</script>

<div class="flex flex-col size-full overflow-hidden relative">
  <!-- KPI strip -->
  <div class="grid grid-cols-4 gap-3 p-4 border-b shrink-0">
    <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Open Alerts</div>
      <div class="text-3xl font-bold tabular-nums text-destructive">{alertsLoading ? '—' : alertCount}</div>
      <div class="text-xs text-muted-foreground">active issues</div>
    </div>
    <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Affected Users</div>
      <div class="text-3xl font-bold tabular-nums text-warning">{alertsLoading ? '—' : alertsByEntityId.size}</div>
      <div class="text-xs text-muted-foreground">have open alerts</div>
    </div>
    <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">MFA %</div>
      <div class="text-3xl font-bold tabular-nums text-success">{loading ? '—' : `${mfaPct}%`}</div>
      <div class="text-xs text-muted-foreground">enforcement rate</div>
    </div>
    <div class="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Users</div>
      <div class="text-3xl font-bold tabular-nums">{loading ? '—' : identities.length}</div>
      <div class="text-xs text-muted-foreground">{alertsByEntityId.size} flagged</div>
    </div>
  </div>

  <div class="flex flex-1 overflow-hidden">
    <!-- Left chart panel -->
    <div class="w-52 shrink-0 border-r p-4 overflow-y-auto flex flex-col gap-4">
      <div>
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">MFA Status</div>
        {#if loading}
          <div class="h-16 bg-muted rounded animate-pulse"></div>
        {:else}
          <div class="flex items-center gap-3">
            <div class="relative shrink-0" style="width:60px;height:60px">
              <svg width="60" height="60" style="transform:rotate(-90deg)">
                <circle cx="30" cy="30" r="25" fill="none" stroke="var(--border)" stroke-width="7" />
                <circle
                  cx="30"
                  cy="30"
                  r="25"
                  fill="none"
                  stroke="var(--success)"
                  stroke-width="7"
                  stroke-dasharray="{(mfaPct / 100) * 2 * Math.PI * 25} {(1 - mfaPct / 100) * 2 * Math.PI * 25}"
                  stroke-linecap="round"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center text-xs font-bold">{mfaPct}%</div>
            </div>
            <div class="flex flex-col gap-1 text-xs">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-success inline-block"></span>
                <span>On: {identities.length - noMfa}</span>
              </div>
              <div class="flex items-center gap-1.5 text-destructive">
                <span class="w-2 h-2 rounded-full bg-destructive inline-block"></span>
                <span>Off: {noMfa}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div>
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Last Sign-in</div>
        {#if loading}
          <div class="h-20 bg-muted rounded animate-pulse"></div>
        {:else}
          <div class="flex flex-col gap-2">
            {#each staleRanges as range}
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-muted-foreground">{range.label}</span>
                  <span style="color:{range.color}">{range.count}</span>
                </div>
                <div class="w-full h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    style="width:{range.pct}%;background:{range.color};height:100%;border-radius:9999px;transition:width 0.4s"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Needs Attention -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm">Needs Attention</span>
          {#if needsAttention.length > 0}
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/15 text-destructive">
              {needsAttention.length}
            </span>
          {/if}
        </div>
        <button
          onclick={onviewall}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all {identities.length} identities →
        </button>
      </div>

      <!-- Quick filters -->
      <div class="flex items-center gap-1.5 px-4 py-2 border-b shrink-0">
        {#each (['High', 'Medium', 'Low', 'Critical'] as const) as label}
          <button
            onclick={() => (activeFilter = activeFilter === label ? null : label)}
            class={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
              activeFilter === label
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
            )}
          >
            {label}
          </button>
        {/each}
      </div>

      <!-- Table -->
      <div class="flex-1 overflow-y-auto">
        {#if loading || alertsLoading}
          <div class="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Loading...
          </div>
        {:else if filteredAttention.length === 0}
          <div class="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No open alerts
          </div>
        {:else}
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-xs text-muted-foreground uppercase tracking-wide">
                <th class="px-4 py-2 text-left">User</th>
                <th class="px-4 py-2 text-left">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredAttention as identity (identity.id)}
                {@const rowAlerts = alertsByEntityId.get(identity.id) ?? []}
                <tr
                  class="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                  onclick={() => onrowclick(identity)}
                >
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-0.5">
                      <span class="font-medium">{identity.name}</span>
                      <span class="text-xs text-muted-foreground">{identity.email}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      {#each rowAlerts as alert (alert.id)}
                        {@const def = alert.definitionId ? ALERT_DEFINITIONS[alert.definitionId] : undefined}
                        <AlertBadge alert={alert} />
                      {/each}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>
</div>
