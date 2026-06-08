<script lang="ts">
  import { cn } from '$lib/utils';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Separator from '$lib/components/ui/separator/separator.svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

  import Plus from '@lucide/svelte/icons/plus';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import Tag from '@lucide/svelte/icons/tag';
  import FileText from '@lucide/svelte/icons/file-text';

  import { wikiState } from '../_wiki-state.svelte.js';
  import type { WikiTag } from '../_mock-data.js';

  // Filter / selected tag
  let selectedTagId = $state<string | null>(null);
  let searchQuery = $state('');

  // Inline new tag
  let addingTag = $state(false);
  let newTagLabel = $state('');
  let newTagColor = $state('oklch(0.62 0.188 259.8)');

  // Editing state
  let editingId = $state<string | null>(null);
  let editLabel = $state('');
  let editColor = $state('');

  const PRESET_COLORS = [
    'oklch(0.62 0.188 259.8)',
    'oklch(0.72 0.18 148.9)',
    'oklch(0.737 0.153 74.2)',
    'oklch(0.637 0.208 25.33)',
    'oklch(0.58 0.18 290)',
    'oklch(0.75 0.18 65)',
    'oklch(0.7 0.18 340)',
    'oklch(0.55 0 0)',
  ];

  const filteredTags = $derived(
    searchQuery.trim()
      ? wikiState.tagList.filter((t) => t.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : wikiState.tagList,
  );

  function articleCountForTag(tagId: string): number {
    return wikiState.articleList.filter((a) => a.tag_ids.includes(tagId)).length;
  }

  function articlesForTag(tagId: string) {
    return wikiState.articleList.filter((a) => a.tag_ids.includes(tagId));
  }

  function startEdit(tag: WikiTag) {
    editingId = tag.id;
    editLabel = tag.label;
    editColor = tag.color;
  }

  function commitEdit() {
    if (editingId && editLabel.trim()) {
      wikiState.updateTag(editingId, { label: editLabel.trim(), color: editColor });
    }
    editingId = null;
  }

  function commitAdd() {
    const label = newTagLabel.trim();
    if (!label) { addingTag = false; return; }
    const id = `tag-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    wikiState.addTag({ id, label, color: newTagColor });
    newTagLabel = '';
    newTagColor = 'oklch(0.62 0.188 259.8)';
    addingTag = false;
  }
</script>

<div class="flex flex-col size-full overflow-y-auto">
  <!-- Header -->
  <div class="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
    <div>
      <h1 class="text-xl font-semibold flex items-center gap-2">
        <Tag class="size-5 text-primary" />
        Tags
      </h1>
      <p class="text-sm text-muted-foreground mt-0.5">
        {wikiState.tagList.length} tags across all articles
      </p>
    </div>
    <Button size="sm" class="gap-1.5" onclick={() => (addingTag = !addingTag)}>
      <Plus class="size-3.5" />
      New Tag
    </Button>
  </div>

  <Separator />

  <div class="flex flex-1 overflow-hidden">
    <!-- Tag table -->
    <div class={cn('flex flex-col overflow-hidden', selectedTagId ? 'w-1/2 border-r' : 'flex-1')}>
      <!-- Search -->
      <div class="px-4 py-3 border-b">
        <Input
          bind:value={searchQuery}
          placeholder="Filter tags…"
          class="h-8 text-sm"
        />
      </div>

      <!-- Inline new tag row -->
      {#if addingTag}
        <div class="flex items-center gap-3 px-4 py-2.5 border-b bg-primary/5">
          <!-- Color picker -->
          <div class="flex items-center gap-1">
            {#each PRESET_COLORS as color (color)}
              <button
                class={cn(
                  'size-4 rounded-full border-2 transition-transform hover:scale-110',
                  newTagColor === color ? 'border-foreground scale-110' : 'border-transparent',
                )}
                style="background-color: {color}"
                onclick={() => (newTagColor = color)}
              ></button>
            {/each}
          </div>
          <input
            bind:value={newTagLabel}
            placeholder="Tag name…"
            class="flex-1 text-sm bg-transparent outline-none border-b border-border/60 py-0.5 placeholder:text-muted-foreground/50"
            onkeydown={(e) => {
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') { addingTag = false; newTagLabel = ''; }
            }}
            autofocus
          />
          <button onclick={commitAdd} class="text-primary hover:opacity-80 shrink-0">
            <Check class="size-4" />
          </button>
          <button onclick={() => { addingTag = false; newTagLabel = ''; }} class="text-muted-foreground hover:opacity-80 shrink-0">
            <X class="size-4" />
          </button>
        </div>
      {/if}

      <!-- Table -->
      <div class="flex-1 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-card/90 backdrop-blur">
            <tr class="border-b text-left text-xs text-muted-foreground">
              <th class="px-4 py-2 font-medium">Tag</th>
              <th class="px-4 py-2 font-medium text-right">Articles</th>
              <th class="px-4 py-2 font-medium w-16"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/40">
            {#each filteredTags as tag (tag.id)}
              {@const count = articleCountForTag(tag.id)}
              <tr
                class={cn(
                  'group hover:bg-muted/30 transition-colors cursor-pointer',
                  selectedTagId === tag.id && 'bg-primary/5',
                )}
                onclick={() => (selectedTagId = selectedTagId === tag.id ? null : tag.id)}
              >
                <td class="px-4 py-2.5">
                  {#if editingId === tag.id}
                    <div class="flex items-center gap-2" onclick={(e) => e.stopPropagation()}>
                      <div class="flex gap-0.5">
                        {#each PRESET_COLORS as color (color)}
                          <button
                            class={cn(
                              'size-3.5 rounded-full border transition-transform hover:scale-110',
                              editColor === color ? 'border-foreground scale-110' : 'border-transparent',
                            )}
                            style="background-color: {color}"
                            onclick={() => (editColor = color)}
                          ></button>
                        {/each}
                      </div>
                      <input
                        bind:value={editLabel}
                        class="text-sm bg-transparent border-b border-border outline-none flex-1"
                        onkeydown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') editingId = null;
                        }}
                        autofocus
                      />
                      <button onclick={commitEdit} class="text-primary"><Check class="size-3.5" /></button>
                      <button onclick={() => (editingId = null)} class="text-muted-foreground"><X class="size-3.5" /></button>
                    </div>
                  {:else}
                    <span
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                      style="background-color: {tag.color}18; color: {tag.color}; border: 1px solid {tag.color}30"
                    >
                      <span class="size-1.5 rounded-full inline-block" style="background-color: {tag.color}"></span>
                      {tag.label}
                    </span>
                  {/if}
                </td>
                <td class="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                  {count}
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end" onclick={(e) => e.stopPropagation()}>
                    <button
                      onclick={() => startEdit(tag)}
                      class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil class="size-3" />
                    </button>
                    <AlertDialog.Root>
                      <AlertDialog.Trigger>
                        {#snippet child({ props })}
                          <button
                            {...props}
                            class="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete tag"
                          >
                            <Trash2 class="size-3" />
                          </button>
                        {/snippet}
                      </AlertDialog.Trigger>
                      <AlertDialog.Content>
                        <AlertDialog.Header>
                          <AlertDialog.Title>Delete {tag.label}?</AlertDialog.Title>
                          <AlertDialog.Description>
                            This removes the tag from the mock and unassigns it from any articles that currently use it.
                          </AlertDialog.Description>
                        </AlertDialog.Header>
                        <AlertDialog.Footer>
                          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                          <AlertDialog.Action
                            class="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                            onclick={() => wikiState.removeTag(tag.id)}
                          >
                            Delete
                          </AlertDialog.Action>
                        </AlertDialog.Footer>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        {#if filteredTags.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Tag class="size-8 mb-2 opacity-30" />
            <p class="text-sm">No tags found</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Articles panel (shown when tag selected) -->
    {#if selectedTagId}
      {@const selTag = wikiState.tags[selectedTagId]}
      {@const tagArticles = articlesForTag(selectedTagId)}
      <div class="flex flex-col flex-1 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b">
          <div class="flex items-center gap-2">
            {#if selTag}
              <span
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                style="background-color: {selTag.color}18; color: {selTag.color}; border: 1px solid {selTag.color}30"
              >
                {selTag.label}
              </span>
            {/if}
            <span class="text-xs text-muted-foreground">{tagArticles.length} articles</span>
          </div>
          <button onclick={() => (selectedTagId = null)} class="text-muted-foreground hover:text-foreground">
            <X class="size-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto divide-y divide-border/40">
          {#each tagArticles as article (article.id)}
            <div class="flex items-center gap-3 px-4 py-2.5 group hover:bg-muted/20 transition-colors">
              <FileText class="size-4 text-muted-foreground shrink-0" />
              <div class="flex-1 min-w-0">
                <a href="/wiki/{article.id}" class="text-sm font-medium hover:text-primary transition-colors truncate block">
                  {article.title}
                </a>
                <p class="text-xs text-muted-foreground">{article.id}</p>
              </div>
              <a href="/wiki/create/{article.id}" class="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-primary">
                Edit
              </a>
            </div>
          {:else}
            <div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No articles with this tag
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
