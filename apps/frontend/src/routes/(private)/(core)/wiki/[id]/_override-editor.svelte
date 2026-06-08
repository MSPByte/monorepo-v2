<script lang="ts">
  import { type WikiOverride, type WikiSite, type OverrideType, MOCK_SITES } from '../_mock-data.js';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import SingleSelect from '$lib/components/single-select.svelte';
  import RichEditor from '../_rich-editor.svelte';

  import Lock from '@lucide/svelte/icons/lock';
  import Save from '@lucide/svelte/icons/save';
  import Send from '@lucide/svelte/icons/send';
  import X from '@lucide/svelte/icons/x';

  const OVERRIDE_TYPES: { value: OverrideType; label: string }[] = [
    { value: 'addendum', label: 'Addendum' },
    { value: 'note', label: 'Note' },
    { value: 'replacement', label: 'Replacement' },
  ];

  const TYPE_COLORS: Record<OverrideType, string> = {
    addendum: 'oklch(0.62 0.188 259.8)',
    note: 'oklch(0.737 0.153 74.2)',
    replacement: 'oklch(0.637 0.208 25.33)',
  };

  interface Props {
    override: WikiOverride | null;
    articleId: string;
    sites?: WikiSite[];
    onClose: () => void;
    onSave: (data: Partial<WikiOverride> & { site_id: string; site_name: string; type: OverrideType }) => void;
  }

  const { override, articleId, sites = MOCK_SITES, onClose, onSave }: Props = $props();

  const isNew = $derived(override === null);
  const isLockedByOther = $derived(
    !!override?.locked_by && override.locked_by !== 'Current User'
  );

  let title = $state(override?.title ?? '');
  let siteId = $state(override?.site_id ?? '');
  let overrideType = $state<OverrideType>(override?.type ?? 'addendum');
  let content = $state(override?.content ?? '');
  let isDirty = $state(false);
  let isSaving = $state(false);

  function markDirty() {
    isDirty = true;
  }

  async function handleSave() {
    if (!siteId || !title.trim()) return;
    isSaving = true;
    await new Promise<void>((r) => setTimeout(r, 600));
    isSaving = false;
    isDirty = false;
    onSave({
      id: override?.id,
      site_id: siteId,
      site_name: sites.find((s) => s.id === siteId)?.name ?? siteId,
      type: overrideType,
      title: title.trim(),
      content,
      article_id: articleId,
    });
  }
</script>

<div class="flex flex-col size-full overflow-hidden">
  <!-- Lock banner -->
  {#if isLockedByOther}
    <div
      class="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 text-warning text-sm shrink-0"
    >
      <Lock class="size-4 shrink-0" />
      <span class="flex-1 min-w-0">
        This override is currently being edited by
        <strong>{override?.locked_by}</strong>. Your changes may conflict.
      </span>
      <Button
        variant="outline"
        size="sm"
        class="shrink-0 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
      >
        Take Over
      </Button>
    </div>
  {/if}

  <!-- Editor header -->
  <div class="flex items-center gap-2 px-4 py-2 border-b bg-card/60 shrink-0">
    <!-- Site + type selectors -->
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <div class="w-44 shrink-0">
        <SingleSelect
          bind:selected={siteId}
          options={sites.map((s) => ({ label: s.name, value: s.id }))}
          disabled={!isNew}
        />
      </div>
      <div class="flex gap-1 shrink-0">
        {#each OVERRIDE_TYPES as t (t.value)}
          <button
            onclick={() => { overrideType = t.value; markDirty(); }}
            class="px-2 py-0.5 rounded text-xs border transition-colors"
            style={overrideType === t.value
              ? `background-color: ${TYPE_COLORS[t.value]}18; color: ${TYPE_COLORS[t.value]}; border-color: ${TYPE_COLORS[t.value]}40`
              : 'border-color: var(--border); color: var(--muted-foreground)'}
          >
            {t.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1.5 shrink-0">
      {#if isDirty}
        <span class="text-xs text-warning hidden sm:block">Unsaved</span>
      {/if}
      <Button variant="ghost" size="sm" class="gap-1.5" disabled={isSaving} onclick={handleSave}>
        <Save class="size-3.5" />
        {isSaving ? 'Saving…' : 'Save Draft'}
      </Button>
      <Button variant="default" size="sm" class="gap-1.5" disabled={!siteId || !title.trim()} onclick={handleSave}>
        <Send class="size-3.5" />
        {isNew ? 'Publish' : 'Update'}
      </Button>
      <Button variant="ghost" size="icon-sm" onclick={onClose} title="Close editor">
        <X class="size-4" />
      </Button>
    </div>
  </div>

  <!-- Title input -->
  <div class="px-4 pt-3 pb-2 shrink-0 border-b">
    <Input
      bind:value={title}
      placeholder="Override title…"
      oninput={markDirty}
      class="text-base font-semibold h-auto p-1 border-0 border-b border-border/50 rounded-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-primary/50 placeholder:text-muted-foreground/35"
    />
  </div>

  <!-- Content editor -->
  <div class="flex flex-col flex-1 overflow-hidden">
    <RichEditor bind:html={content} onchange={markDirty} class="min-h-full" />
    <p class="text-xs text-muted-foreground/50 mt-1.5">
      {isNew ? 'Creating a new override will lock it to you until published.' : 'Saving updates the draft and maintains your lock.'}
    </p>
  </div>
</div>
