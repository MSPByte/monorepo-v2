<script lang="ts">
  import { getContext } from 'svelte';
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import { getLocalTimeZone, today } from "@internationalized/date";
  import type { CalendarDate } from "@internationalized/date";
  import DatePicker from "$lib/components/date-picker.svelte";
  import type { createTrpcClient } from '$lib/trpc';

  let { id, open = $bindable(), onsuppress }: { id: string; open?: boolean; onsuppress?: () => void } = $props();

  const trpc = getContext<ReturnType<typeof createTrpcClient>>('trpc');

  let saving = $state(false);
  let suppressDate = $state<CalendarDate | undefined>(undefined);

  const presets = [
    { label: "1 week",   days: 7   },
    { label: "2 weeks",  days: 14  },
    { label: "1 month",  days: 30  },
    { label: "3 months", days: 90  },
    { label: "6 months", days: 180 },
  ];

  function applyPreset(days: number) {
    suppressDate = today(getLocalTimeZone()).add({ days });
  }

  function isActivePreset(days: number): boolean {
    if (!suppressDate) return false;
    return suppressDate.toString() === today(getLocalTimeZone()).add({ days }).toString();
  }

  const suppressAlert = async () => {
    if (!suppressDate) return;
    saving = true;

    const until = suppressDate.toDate(getLocalTimeZone());
    if (until <= new Date()) return;

    await trpc.alerts.suppress.mutate({ alertId: id, until: until.toISOString() });

    open = false;
    saving = false;
    suppressDate = undefined;
    onsuppress?.();
  }
</script>

<Dialog.Root bind:open={open}>
  <Dialog.Content class="max-w-sm gap-0 p-0 overflow-hidden">

    <!-- Header zone -->
    <div class="flex flex-col items-center gap-3 px-6 pt-8 pb-6 border-b border-border/50 text-center">
      <div class="flex items-center justify-center size-12 rounded-2xl bg-warning/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-warning"
          aria-hidden="true"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      </div>
      <Dialog.Header class="gap-1.5 items-center">
        <Dialog.Title class="text-base font-semibold">Suppress Alert</Dialog.Title>
        <Dialog.Description class="text-sm text-muted-foreground leading-snug max-w-[24ch]">
          Silence this alert until a date you choose. You can unsuppress it at any time.
        </Dialog.Description>
      </Dialog.Header>
    </div>

    <!-- Body zone -->
    <div class="flex flex-col gap-5 px-6 py-5">

      <div class="flex flex-col gap-2">
        <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
          Quick select
        </span>
        <div class="flex flex-wrap gap-1.5">
          {#each presets as preset}
            <button
              type="button"
              onclick={() => applyPreset(preset.days)}
              class={[
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                isActivePreset(preset.days)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              ].join(" ")}
            >
              {preset.label}
            </button>
          {/each}
        </div>
      </div>

      <DatePicker
        title="Suppress Until"
        maxValue={today(getLocalTimeZone()).add({ days: 180 })}
        bind:value={suppressDate}
      />

    </div>

    <!-- Footer zone -->
    <div class="flex gap-2 px-6 pb-6">
      <Button variant="outline" class="flex-1" onclick={() => open = false}>
        Cancel
      </Button>
      <Button
        variant="destructive"
        class="flex-1"
        onclick={suppressAlert}
        disabled={!suppressDate || saving}
      >
        {saving ? "Suppressing..." : "Suppress"}
      </Button>
    </div>

  </Dialog.Content>
</Dialog.Root>
