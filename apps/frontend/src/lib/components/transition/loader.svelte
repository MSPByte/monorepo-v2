<script lang="ts">
  import { LoaderCircle } from '@lucide/svelte';

  let { size = 48 }: { size?: number } = $props();
</script>

<div class="flex items-center justify-center w-full h-full">
  <LoaderCircle class="animate-spin text-muted-foreground" {size} />
</div>
