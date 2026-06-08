<script lang="ts">
  import '../create/[id]/_editor.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    type WikiOverride,
    getContextPath,
    MOCK_ARTICLE_VERSIONS,
    MOCK_SITES,
  } from '../_mock-data.js';
  import { wikiState } from '../_wiki-state.svelte.js';
  import OverrideEditor from './_override-editor.svelte';
  import KbRefPopover from '../_kb-ref-popover.svelte';

  import Button from '$lib/components/ui/button/button.svelte';
  import Separator from '$lib/components/ui/separator/separator.svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Pencil from '@lucide/svelte/icons/pencil';
  import X from '@lucide/svelte/icons/x';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Globe from '@lucide/svelte/icons/globe';
  import GripHorizontal from '@lucide/svelte/icons/grip-horizontal';
  import Clock from '@lucide/svelte/icons/clock';
  import FileText from '@lucide/svelte/icons/file-text';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import Link from '@lucide/svelte/icons/link';
  import Maximize2 from '@lucide/svelte/icons/maximize-2';
  import Minimize2 from '@lucide/svelte/icons/minimize-2';
  import Shield from '@lucide/svelte/icons/shield';
  import { formatStringProper } from '$lib/utils/format.js';
  import { Circle, DotIcon } from '@lucide/svelte';

  const articleId = $derived(page.params.id ?? '');
  const article = $derived(wikiState.articles[articleId]);

  const primaryContextPath = $derived(
    article ? getContextPath(article.primary_context_id, wikiState.contexts) : []
  );
  const linkedContexts = $derived(
    article
      ? article.linked_context_ids
          .map((id) => wikiState.contexts.find((context) => context.id === id))
          .filter((context): context is NonNullable<typeof context> => !!context)
      : []
  );

  // Wrap KB\d+ in highlighted spans for the popover layer
  function processKbRefs(html: string): string {
    return html.replace(
      /\bKB\d{3,4}\b/g,
      (match) => `<span class="kb-ref" data-kb-id="${match}">${match}</span>`
    );
  }

  const processedBody = $derived(article ? processKbRefs(article.body) : '');

  // KB* magic link detection
  const KB_PATTERN = /\bKB\d{3,4}\b/g;
  const relatedArticles = $derived.by(() => {
    if (!article) return [];
    const matches = [...new Set(article.body.match(KB_PATTERN) ?? [])] as string[];
    return matches
      .map((kb) => wikiState.articles[kb])
      .filter((a): a is NonNullable<typeof a> => !!a && a.id !== article.id);
  });

  const overrides = $derived(wikiState.overrides.filter((o) => o.article_id === articleId));
  const versions = $derived(
    MOCK_ARTICLE_VERSIONS.filter((v) => v.article_id === articleId).sort(
      (a, b) => b.version_number - a.version_number
    )
  );

  // Panel state
  let selectedOverride = $state<WikiOverride | null>(null);
  let isEditingOverride = $state(false);
  let isNewOverride = $state(false);
  let overridePanelHeight = $state(360);
  let overridePanelExpanded = $state(false);
  let panelSearch = $state('');
  let openSections = $state({
    contexts: true,
    overrides: true,
    related: true,
    history: true,
    permissions: true,
  });

  // Filtered panel content
  const q = $derived(panelSearch.toLowerCase());
  const filteredOverrides = $derived(
    q
      ? overrides.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            o.site_name.toLowerCase().includes(q) ||
            o.type.includes(q)
        )
      : overrides
  );
  const filteredRelated = $derived(
    q
      ? relatedArticles.filter(
          (a) => a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
        )
      : relatedArticles
  );
  const filteredVersions = $derived(
    q
      ? versions.filter(
          (v) =>
            v.changed_by.toLowerCase().includes(q) ||
            (v.change_note ?? '').toLowerCase().includes(q) ||
            String(v.version_number).includes(q)
        )
      : versions
  );

  const OVERRIDE_TYPE_COLORS: Record<string, string> = {
    addendum: 'oklch(0.62 0.188 259.8)',
    note: 'oklch(0.737 0.153 74.2)',
    replacement: 'oklch(0.637 0.208 25.33)',
  };

  function selectOverride(o: WikiOverride) {
    selectedOverride = o;
    isEditingOverride = false;
    isNewOverride = false;
  }

  function openNewOverride() {
    selectedOverride = null;
    isNewOverride = true;
    isEditingOverride = true;
  }

  function editSelectedOverride() {
    isEditingOverride = true;
    isNewOverride = false;
  }

  function closeOverridePanel() {
    selectedOverride = null;
    isEditingOverride = false;
    isNewOverride = false;
  }

  function handleOverrideSave(data: Partial<WikiOverride> & { site_id: string }) {
    const saved = wikiState.upsertOverride({ ...data, article_id: articleId });
    selectedOverride = saved;
    isEditingOverride = false;
    isNewOverride = false;
  }

  function deleteSelectedOverride() {
    if (!selectedOverride) return;
    wikiState.removeOverride(selectedOverride.id);
    closeOverridePanel();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function toggleSection(key: keyof typeof openSections) {
    openSections[key] = !openSections[key];
  }

  function startOverridePanelResize(e: PointerEvent) {
    e.preventDefault();
    overridePanelExpanded = false;
    const startY = e.clientY;
    const startHeight = overridePanelHeight;

    function onPointerMove(moveEvent: PointerEvent) {
      const next = startHeight + (startY - moveEvent.clientY);
      const max = Math.max(360, window.innerHeight - 160);
      overridePanelHeight = Math.min(Math.max(next, 280), max);
    }

    function onPointerUp() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }
</script>

{#if article}
  <div class="flex flex-col size-full overflow-hidden">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-2 border-b bg-card/70 backdrop-blur shrink-0 gap-2"
    >
      <div class="flex items-center gap-2 min-w-0">
        <Button variant="ghost" size="icon-sm" href="/wiki" title="Back to wiki">
          <ArrowLeft class="size-4" />
        </Button>
        <span class="text-xs text-muted-foreground font-mono">{article.id}</span>
        <DotIcon class="size-4" />
        <span class="text-sm font-medium truncate">{article.title}</span>
        <!-- Tags -->
        {#if article.tag_ids.length > 0}
          <DotIcon class="size-4" />
          <div class="flex items-center gap-1.5 flex-wrap">
            {#each article.tag_ids as tid (tid)}
              {@const tag = wikiState.tags[tid]}
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs border"
                style={tag
                  ? `background-color: ${tag.color}18; color: ${tag.color}; border-color: ${tag.color}30`
                  : 'background-color: var(--primary)/10; color: var(--primary); border-color: var(--primary)/20'}
              >
                {tag?.label ?? tid}
              </span>
            {/each}
          </div>
        {/if}
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm" class="gap-1.5" href="/wiki/create/{article.id}">
          <Pencil class="size-3.5" />
          Edit
        </Button>
        <AlertDialog.Root>
          <AlertDialog.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="outline" size="sm" class="gap-1.5 text-destructive">
                <Trash2 class="size-3.5" />
                Delete
              </Button>
            {/snippet}
          </AlertDialog.Trigger>
          <AlertDialog.Content>
            <AlertDialog.Header>
              <AlertDialog.Title>Delete {article.id}?</AlertDialog.Title>
              <AlertDialog.Description>
                This removes the article and all customer/site overrides from the mock wiki.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                class="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                onclick={() => {
                  wikiState.removeArticle(article.id);
                  goto('/wiki');
                }}
              >
                Delete
              </AlertDialog.Action>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </div>
    </div>

    <!-- Body -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left: article content + override panel -->
      <div class="flex flex-col flex-1 overflow-hidden">
        <!-- Article scroll area -->
        <div class="flex-1 overflow-y-auto">
          <div class="max-w-4xl mx-auto px-8 py-6 flex flex-col gap-3">
            <!-- Primary context -->
            {#if primaryContextPath.length > 0}
              <nav class="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                <span class="font-medium text-foreground/70">Primary Context</span>
                <span class="text-muted-foreground/40">·</span>
                {#each primaryContextPath as cat, i (cat.id)}
                  {#if i > 0}
                    <ChevronRight class="size-3 shrink-0" />
                  {/if}
                  <a href="/wiki/category/{cat.id}" class="hover:text-foreground transition-colors">
                    {cat.label}
                  </a>
                {/each}
              </nav>
            {/if}

            <!-- Author + date -->
            <p class="text-xs text-muted-foreground">
              By <strong class="text-foreground">{article.author}</strong>
              &nbsp;·&nbsp; Updated {formatDate(article.updated_at)}
            </p>

            {#if linkedContexts.length > 0}
              <div class="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                <Link class="size-3.5" />
                <span class="font-medium text-foreground/70">Linked in</span>
                {#each linkedContexts as context (context.id)}
                  <a
                    href="/wiki/category/{context.id}"
                    class="rounded-full border px-2 py-0.5 transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {context.label}
                  </a>
                {/each}
              </div>
            {/if}

            <Separator />

            <!-- Article body -->
            <KbRefPopover>
              <div class="tiptap">
                {@html processedBody}
              </div>
            </KbRefPopover>
          </div>
        </div>

        <!-- Override bottom panel -->
        {#if selectedOverride !== null || isNewOverride}
          <div
            class="border-t bg-background flex flex-col shrink-0 overflow-hidden"
            style={overridePanelExpanded
              ? 'height: min(72vh, calc(100% - 4rem));'
              : `height: ${overridePanelHeight}px;`}
          >
            <div class="flex h-8 shrink-0 items-center justify-between border-b bg-muted/30 px-3">
              <button
                class="flex flex-1 cursor-row-resize items-center justify-center text-muted-foreground hover:text-foreground"
                onpointerdown={startOverridePanelResize}
                title="Drag to resize override panel"
              >
                <GripHorizontal class="size-4" />
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                title={overridePanelExpanded ? 'Restore override panel' : 'Expand override panel'}
                onclick={() => (overridePanelExpanded = !overridePanelExpanded)}
              >
                {#if overridePanelExpanded}
                  <Minimize2 class="size-3.5" />
                {:else}
                  <Maximize2 class="size-3.5" />
                {/if}
              </Button>
            </div>
            {#if isEditingOverride}
              <!-- Editor mode -->
              <OverrideEditor
                override={isNewOverride ? null : selectedOverride}
                articleId={article.id}
                sites={MOCK_SITES}
                onClose={closeOverridePanel}
                onSave={handleOverrideSave}
              />
            {:else if selectedOverride}
              <!-- Viewer mode -->
              <div class="flex items-center gap-2 px-4 py-2 border-b bg-card/80 shrink-0">
                <span
                  class="text-xs px-1.5 py-0.5 rounded border font-medium shrink-0"
                  style={`background-color: ${OVERRIDE_TYPE_COLORS[selectedOverride.type]}18; color: ${OVERRIDE_TYPE_COLORS[selectedOverride.type]}; border-color: ${OVERRIDE_TYPE_COLORS[selectedOverride.type]}40`}
                >
                  {selectedOverride.type}
                </span>
                <span class="text-xs text-muted-foreground shrink-0"
                  >{selectedOverride.site_name}</span
                >
                <span class="text-muted-foreground/30 shrink-0">·</span>
                <span class="text-sm font-medium truncate flex-1">{selectedOverride.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  class="gap-1.5 shrink-0"
                  onclick={editSelectedOverride}
                >
                  <Pencil class="size-3.5" />
                  Edit
                </Button>
                <AlertDialog.Root>
                  <AlertDialog.Trigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon-sm"
                        title="Delete override"
                        class="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    {/snippet}
                  </AlertDialog.Trigger>
                  <AlertDialog.Content>
                    <AlertDialog.Header>
                      <AlertDialog.Title>Delete override?</AlertDialog.Title>
                      <AlertDialog.Description>
                        This removes the selected customer/site override from the mock article.
                      </AlertDialog.Description>
                    </AlertDialog.Header>
                    <AlertDialog.Footer>
                      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                      <AlertDialog.Action
                        class="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                        onclick={deleteSelectedOverride}
                      >
                        Delete
                      </AlertDialog.Action>
                    </AlertDialog.Footer>
                  </AlertDialog.Content>
                </AlertDialog.Root>
                <Button variant="ghost" size="icon-sm" onclick={closeOverridePanel} title="Close">
                  <X class="size-4" />
                </Button>
              </div>
              <div class="flex-1 overflow-y-auto px-6 py-4">
                <KbRefPopover>
                  <div class="tiptap">
                    {@html processKbRefs(selectedOverride.content)}
                  </div>
                </KbRefPopover>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Right context panel -->
      <div class="w-72 shrink-0 border-l flex-col overflow-hidden hidden lg:flex">
        <!-- Panel search -->
        <div class="border-b px-3 py-2 shrink-0 flex items-center gap-2">
          <Search class="size-3.5 text-muted-foreground shrink-0" />
          <input
            bind:value={panelSearch}
            placeholder="Search panel…"
            class="text-sm bg-transparent border-0 outline-none flex-1 text-foreground placeholder:text-muted-foreground/50"
          />
          {#if panelSearch}
            <button
              onclick={() => (panelSearch = '')}
              class="text-muted-foreground hover:text-foreground"
            >
              <X class="size-3.5" />
            </button>
          {/if}
        </div>

        <!-- Scrollable sections -->
        <div class="flex-1 overflow-y-auto">
          <!-- Contexts -->
          <div class="border-b">
            <button
              onclick={() => toggleSection('contexts')}
              class="flex items-center justify-between w-full px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <FolderOpen class="size-3.5" />
                Contexts
              </div>
              <ChevronDown
                class="size-3.5 transition-transform {openSections.contexts ? '' : '-rotate-90'}"
              />
            </button>

            {#if openSections.contexts}
              <div class="pb-2">
                {#if primaryContextPath.length > 0}
                  <a
                    href="/wiki/category/{article.primary_context_id}"
                    class="flex flex-col gap-1 px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <span class="text-xs font-medium text-foreground">Primary Context</span>
                    <span class="text-xs text-muted-foreground">
                      {primaryContextPath.map((c) => c.label).join(' / ')}
                    </span>
                  </a>
                {/if}
                {#if linkedContexts.length > 0}
                  <div class="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                    Linked Appearances
                  </div>
                  {#each linkedContexts as context (context.id)}
                    <a
                      href="/wiki/category/{context.id}"
                      class="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <Link class="size-3.5 text-muted-foreground" />
                      <span class="text-xs text-foreground truncate">{context.label}</span>
                    </a>
                  {/each}
                {:else}
                  <p class="px-3 py-2 text-xs text-muted-foreground/60">No linked appearances.</p>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Overrides -->
          <div class="border-b">
            <button
              onclick={() => toggleSection('overrides')}
              class="flex items-center justify-between w-full px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <FileText class="size-3.5" />
                Overrides
                {#if filteredOverrides.length > 0}
                  <span
                    class="ml-0.5 px-1.5 py-0 rounded-full bg-muted text-muted-foreground font-normal text-xs"
                  >
                    {filteredOverrides.length}
                  </span>
                {/if}
              </div>
              <ChevronDown
                class="size-3.5 transition-transform {openSections.overrides ? '' : '-rotate-90'}"
              />
            </button>

            {#if openSections.overrides}
              <div class="pb-2">
                {#each filteredOverrides as o (o.id)}
                  <button
                    onclick={() => selectOverride(o)}
                    class="flex flex-col gap-1 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors {selectedOverride?.id ===
                    o.id
                      ? 'bg-primary/5'
                      : ''}"
                  >
                    <div class="flex w-full justify-between items-center">
                      <p class="text-xs font-medium text-foreground truncate">{o.site_name}</p>
                      <span
                        class="text-xs px-1.5 py-0 rounded border shrink-0"
                        style={`background-color: ${OVERRIDE_TYPE_COLORS[o.type]}18; color: ${OVERRIDE_TYPE_COLORS[o.type]}; border-color: ${OVERRIDE_TYPE_COLORS[o.type]}40`}
                      >
                        {formatStringProper(o.type)}
                      </span>
                    </div>
                    <p class="text-xs text-muted-foreground truncate">{o.title}</p>
                  </button>
                {/each}

                {#if filteredOverrides.length === 0 && !panelSearch}
                  <p class="px-3 py-2 text-xs text-muted-foreground/60">No overrides yet.</p>
                {:else if filteredOverrides.length === 0}
                  <p class="px-3 py-2 text-xs text-muted-foreground/60">No matches.</p>
                {/if}

                <div class="px-3 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="w-full gap-1.5 text-xs justify-start text-muted-foreground hover:text-foreground"
                    onclick={openNewOverride}
                  >
                    <Plus class="size-3.5" />
                    Add Override
                  </Button>
                </div>
              </div>
            {/if}
          </div>

          <!-- Related Articles -->
          <div class="border-b">
            <button
              onclick={() => toggleSection('related')}
              class="flex items-center justify-between w-full px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <FileText class="size-3.5" />
                Related Articles
                {#if filteredRelated.length > 0}
                  <span
                    class="ml-0.5 px-1.5 py-0 rounded-full bg-muted text-muted-foreground font-normal text-xs"
                  >
                    {filteredRelated.length}
                  </span>
                {/if}
              </div>
              <ChevronDown
                class="size-3.5 transition-transform {openSections.related ? '' : '-rotate-90'}"
              />
            </button>

            {#if openSections.related}
              <div class="pb-2">
                {#each filteredRelated as rel (rel.id)}
                  <a
                    href="/wiki/{rel.id}"
                    class="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors group"
                    target="_blank"
                  >
                    <span class="text-xs font-mono text-muted-foreground shrink-0">{rel.id}</span>
                    <span
                      class="text-xs text-foreground truncate flex-1 group-hover:text-primary transition-colors"
                    >
                      {rel.title}
                    </span>
                  </a>
                {/each}
                {#if filteredRelated.length === 0}
                  <p class="px-3 py-2 text-xs text-muted-foreground/60">
                    {panelSearch ? 'No matches.' : 'No KB# references found in content.'}
                  </p>
                {/if}
              </div>
            {/if}
          </div>

          <!-- History -->
          <div class="border-b">
            <button
              onclick={() => toggleSection('history')}
              class="flex items-center justify-between w-full px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <Clock class="size-3.5" />
                History
                {#if filteredVersions.length > 0}
                  <span
                    class="ml-0.5 px-1.5 py-0 rounded-full bg-muted text-muted-foreground font-normal text-xs"
                  >
                    {filteredVersions.length}
                  </span>
                {/if}
              </div>
              <ChevronDown
                class="size-3.5 transition-transform {openSections.history ? '' : '-rotate-90'}"
              />
            </button>

            {#if openSections.history}
              <div class="pb-2">
                {#each filteredVersions as v (v.id)}
                  <div class="flex items-start gap-2 px-3 py-2">
                    <span class="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                      v{v.version_number}
                    </span>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs text-foreground truncate">
                        {v.change_note ?? 'Initial version'}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {v.changed_by} · {formatDate(v.created_at)}
                      </p>
                    </div>
                  </div>
                {/each}
                {#if filteredVersions.length === 0}
                  <p class="px-3 py-2 text-xs text-muted-foreground/60">
                    {panelSearch ? 'No matches.' : 'No version history.'}
                  </p>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Permissions -->
          <div>
            <button
              onclick={() => toggleSection('permissions')}
              class="flex items-center justify-between w-full px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <Shield class="size-3.5" />
                Permissions
              </div>
              <ChevronDown
                class="size-3.5 transition-transform {openSections.permissions ? '' : '-rotate-90'}"
              />
            </button>

            {#if openSections.permissions}
              <div class="px-3 pb-4">
                <div class="flex items-center gap-2 py-2">
                  <Globe class="size-4 text-success shrink-0" />
                  <span class="text-sm text-foreground">Visible to all members</span>
                </div>
                <p class="text-xs text-muted-foreground/60">
                  Granular permission controls are coming soon.
                </p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="flex flex-col items-center justify-center size-full gap-3 text-muted-foreground">
    <FileText class="size-10 opacity-30" />
    <p class="text-sm">Article <span class="font-mono">{articleId}</span> not found.</p>
    <Button variant="outline" size="sm" href="/wiki">Back to Wiki</Button>
  </div>
{/if}
