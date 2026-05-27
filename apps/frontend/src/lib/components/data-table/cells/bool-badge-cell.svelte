<script lang="ts">
  import Badge from '$lib/components/ui/badge/badge.svelte';

  let {
    value,
    trueLabel = 'Yes',
    falseLabel = 'No',
    falseVariant = 'muted',
    evaluate,
  }: {
    value: unknown;
    trueLabel?: string;
    falseLabel?: string;
    falseVariant?: 'muted' | 'destructive';
    evaluate?: (value: unknown) => boolean;
  } = $props();

  const boolValue = $derived(evaluate ? evaluate(value) : (value as boolean | null));

  const falseClass = $derived(
    falseVariant === 'destructive'
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
  );
</script>

{#if boolValue === null || boolValue === undefined}
  <span class="text-muted-foreground">—</span>
{:else}
  <Badge
    variant="outline"
    class={boolValue ? 'bg-green-500/15 text-green-500 border-green-500/30' : falseClass}
  >
    {boolValue ? trueLabel : falseLabel}
  </Badge>
{/if}
