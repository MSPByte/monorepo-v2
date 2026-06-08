<script lang="ts">
  import { cn } from '$lib/utils';
  import * as Collapsible from '$lib/components/ui/collapsible/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import CategoryTreeItem from './_category-tree-item.svelte';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Plus from '@lucide/svelte/icons/plus';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import Folder from '@lucide/svelte/icons/folder';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';

  import {
    getCategoryChildren,
    getArticleCount,
    type WikiCategory,
    type WikiArticle,
  } from './_mock-data.js';
  import { wikiState } from './_wiki-state.svelte.js';

  interface Props {
    category: WikiCategory;
    depth?: number;
    categories: WikiCategory[];
    articles: WikiArticle[];
    openIds: Set<string>;
    activeCategoryId: string;
    ontoggle: (id: string) => void;
  }

  const {
    category,
    depth = 0,
    categories,
    articles,
    openIds,
    activeCategoryId,
    ontoggle,
  }: Props = $props();

  const children = $derived(getCategoryChildren(category.id, categories));
  const hasChildren = $derived(children.length > 0);
  const isOpen = $derived(openIds.has(category.id));
  const isActive = $derived(activeCategoryId === category.id);
  const articleCount = $derived(getArticleCount(category.id, articles));

  // Inline rename state
  let renaming = $state(false);
  let renameValue = $state('');
  let addingChild = $state(false);
  let newChildName = $state('');

  function startRename() {
    renameValue = category.label;
    renaming = true;
  }

  function commitRename() {
    if (renameValue.trim()) {
      wikiState.updateCategory(category.id, { label: renameValue.trim() });
    }
    renaming = false;
  }

  function cancelRename() {
    renaming = false;
  }

  function commitAddChild() {
    const label = newChildName.trim();
    if (!label) {
      addingChild = false;
      return;
    }
    const id = `cat-${Date.now()}`;
    wikiState.addCategory({ id, label, parent_id: category.id });
    if (!openIds.has(category.id)) ontoggle(category.id);
    newChildName = '';
    addingChild = false;
  }
</script>

<div>
  <!-- Category row -->
  <div
    class={cn('group/cat flex items-center gap-0.5 rounded-md', isActive && 'bg-sidebar-accent')}
  >
    <!-- Expand toggle -->
    {#if hasChildren || addingChild}
      <Collapsible.Root>
        <Collapsible.Trigger
          class="p-1 rounded hover:bg-sidebar-accent/60 transition-colors shrink-0 cursor-pointer"
          onclick={() => ontoggle(category.id)}
        >
          <ChevronRight
            class={cn(
              'size-3 text-muted-foreground transition-transform duration-150',
              isOpen && 'rotate-90'
            )}
          />
        </Collapsible.Trigger>
      </Collapsible.Root>
    {:else}
      <div class="w-5 shrink-0"></div>
    {/if}

    <!-- Label / rename input -->
    {#if renaming}
      <div class="flex items-center gap-1 flex-1 py-1 pr-1 min-w-0">
        <input
          bind:value={renameValue}
          class="flex-1 min-w-0 text-sm bg-background border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary/50"
          onkeydown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') cancelRename();
          }}
          autofocus
        />
        <button onclick={commitRename} class="text-primary hover:opacity-80"
          ><Check class="size-3" /></button
        >
        <button onclick={cancelRename} class="text-muted-foreground hover:opacity-80"
          ><X class="size-3" /></button
        >
      </div>
    {:else}
      <a
        href="/wiki/category/{category.id}"
        class={cn(
          'flex items-center gap-2 flex-1 px-1 py-1.5 text-sm transition-colors hover:text-foreground min-w-0',
          isActive ? 'text-sidebar-accent-foreground font-medium' : 'text-muted-foreground'
        )}
        style="padding-left: {depth * 4}px"
      >
        {#if isActive}
          <FolderOpen class="size-3.5 shrink-0 text-primary" />
        {:else}
          <Folder class="size-3.5 shrink-0" />
        {/if}
        <span class="flex-1 truncate">{category.label}</span>
        {#if articleCount > 0}
          <span class="text-xs tabular-nums opacity-60">{articleCount}</span>
        {/if}
      </a>

      <!-- Hover actions -->
      <div
        class="flex items-center gap-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity pr-1 shrink-0"
      >
        <button
          class="p-0.5 rounded hover:bg-sidebar-accent/60 text-muted-foreground hover:text-foreground transition-colors"
          onclick={() => {
            addingChild = true;
            if (!openIds.has(category.id)) ontoggle(category.id);
          }}
          title="Add subcategory"
        >
          <Plus class="size-3" />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <button
                class="p-0.5 rounded hover:bg-sidebar-accent/60 text-muted-foreground hover:text-foreground transition-colors"
                title="Category options"
                {...props}
              >
                <Ellipsis class="size-3" />
              </button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content class="w-36">
            <DropdownMenu.Item class="gap-2 cursor-pointer" onclick={startRename}>
              <Pencil class="size-3.5" /> Rename
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              class="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onclick={() => wikiState.removeCategory(category.id)}
            >
              <Trash2 class="size-3.5" /> Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    {/if}
  </div>

  <!-- Children -->
  <Collapsible.Root open={isOpen}>
    <Collapsible.Content>
      <div class="ml-3 border-l border-border/30 pl-1">
        {#each children as child (child.id)}
          <CategoryTreeItem
            category={child}
            depth={depth + 1}
            {categories}
            {articles}
            {openIds}
            {activeCategoryId}
            {ontoggle}
          />
        {/each}

        <!-- Inline add child input -->
        {#if addingChild}
          <div class="flex items-center gap-1 py-1 pl-2 pr-1">
            <Folder class="size-3 text-muted-foreground shrink-0" />
            <input
              bind:value={newChildName}
              placeholder="Category name…"
              class="flex-1 min-w-0 text-xs bg-background border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary/50"
              onkeydown={(e) => {
                if (e.key === 'Enter') commitAddChild();
                if (e.key === 'Escape') {
                  addingChild = false;
                  newChildName = '';
                }
              }}
              autofocus
            />
            <button onclick={commitAddChild} class="text-primary hover:opacity-80"
              ><Check class="size-3" /></button
            >
            <button
              onclick={() => {
                addingChild = false;
                newChildName = '';
              }}
              class="text-muted-foreground hover:opacity-80"><X class="size-3" /></button
            >
          </div>
        {/if}
      </div>
    </Collapsible.Content>
  </Collapsible.Root>
</div>
