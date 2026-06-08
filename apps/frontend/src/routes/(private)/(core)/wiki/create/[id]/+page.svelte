<script lang="ts">
  import './_editor.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getContextPath, type WikiArticle } from '../../_mock-data.js';
  import { wikiState } from '../../_wiki-state.svelte.js';
  import RichEditor from '../../_rich-editor.svelte';

  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Separator from '$lib/components/ui/separator/separator.svelte';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import MultiSelect from '$lib/components/multi-select.svelte';

  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Lock from '@lucide/svelte/icons/lock';
  import Save from '@lucide/svelte/icons/save';
  import Send from '@lucide/svelte/icons/send';
  import SingleSelect from '$lib/components/single-select.svelte';

  // Route param
  const articleId = $derived(page.params.id);
  const isNew = $derived(articleId === 'new');

  function loadArticle(id: string): WikiArticle {
    if (id === 'new') {
      return {
        id: 'new',
        title: '',
        primary_context_id: page.url.searchParams.get('context') ?? '',
        linked_context_ids: [],
        tag_ids: [],
        body: '<p></p>',
        locked_by: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
        author: 'Current User',
      };
    }
    return (
      wikiState.articles[id] ?? {
        id,
        title: '',
        primary_context_id: '',
        linked_context_ids: [],
        tag_ids: [],
        body: '<p></p>',
        locked_by: null,
        locked_at: null,
        updated_at: new Date().toISOString(),
        author: 'Current User',
      }
    );
  }

  // State — use page.params.id directly to avoid $derived-in-$state warning
  let article = $state(loadArticle(page.params.id ?? 'new'));
  let title = $state(article.title);
  let contextId = $state(article.primary_context_id);
  let linkedContextIds = $state<string[]>([...article.linked_context_ids]);
  let tagIds = $state<string[]>([...article.tag_ids]);
  let bodyHtml = $state(article.body);
  let isDirty = $state(false);
  let isSaving = $state(false);

  const isLocked = $derived(!!article.locked_by);

  const contextOptions = $derived(
    wikiState.contexts.map((c) => ({ label: contextOptionLabel(c.id), value: c.id }))
  );
  const linkedContextOptions = $derived(
    contextOptions.filter((option) => option.value !== contextId)
  );
  const tagOptions = $derived(
    wikiState.tagList.map((tag) => ({ label: tag.label, value: tag.id }))
  );

  async function persistArticle() {
    if (!title.trim() || !contextId) return;
    isSaving = true;
    await new Promise<void>((r) => setTimeout(r, 600));
    const saved = wikiState.upsertArticle({
      id: isNew ? undefined : article.id,
      title: title.trim(),
      primary_context_id: contextId,
      linked_context_ids: linkedContextIds.filter((id) => id !== contextId),
      tag_ids: tagIds,
      body: bodyHtml,
      locked_by: isNew ? null : article.locked_by,
      locked_at: isNew ? null : article.locked_at,
      updated_at: new Date().toISOString(),
      author: isNew ? 'Current User' : article.author,
    });
    isSaving = false;
    isDirty = false;
    goto(`/wiki/${saved.id}`);
  }

  function contextOptionLabel(contextId: string): string {
    return getContextPath(contextId, wikiState.contexts)
      .map((context) => context.label)
      .join(' / ');
  }

  $effect(() => {
    if (linkedContextIds.includes(contextId)) {
      linkedContextIds = linkedContextIds.filter((id) => id !== contextId);
    }
  });
</script>

<div class="flex flex-col size-full overflow-hidden">
  <!-- Header bar -->
  <div
    class="flex items-center justify-between px-4 py-2 border-b bg-card/70 backdrop-blur shrink-0 gap-2"
  >
    <div class="flex items-center gap-2 min-w-0">
      <Button
        variant="ghost"
        size="icon-sm"
        href={page.url.searchParams.get('context')
          ? `/wiki/category/${page.url.searchParams.get('context')}`
          : '/wiki'}
        title="Back to wiki"
      >
        <ArrowLeft class="size-4" />
      </Button>
      <span class="text-sm text-muted-foreground truncate">
        {isNew ? 'New Article' : article.id}
      </span>
      {#if isDirty}
        <Badge
          class="bg-warning/10 text-warning border-warning/30 text-xs px-1.5 py-0 hidden sm:inline-flex"
        >
          Unsaved
        </Badge>
      {/if}
    </div>

    <div class="flex items-center gap-1.5 shrink-0">
      <Button
        variant="ghost"
        size="sm"
        class="gap-1.5"
        disabled={isSaving}
        onclick={persistArticle}
      >
        <Save class="size-3.5" />
        {isSaving ? 'Saving…' : 'Save Draft'}
      </Button>
      {#if !isNew}
        <Button
          variant="default"
          size="sm"
          class="gap-1.5"
          disabled={!title.trim() || !contextId}
          onclick={persistArticle}
        >
          <Send class="size-3.5" />
          Publish
        </Button>
      {:else}
        <Button
          variant="default"
          size="sm"
          class="gap-1.5"
          disabled={!title.trim() || !contextId}
          onclick={persistArticle}
        >
          <Send class="size-3.5" />
          Create
        </Button>
      {/if}
    </div>
  </div>

  <!-- Lock banner -->
  {#if isLocked}
    <div
      class="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 text-warning text-sm shrink-0"
    >
      <Lock class="size-4 shrink-0" />
      <span class="flex-1 min-w-0">
        This article is currently being edited by
        <strong>{article.locked_by}</strong>. Your changes may conflict.
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

  <!-- Scrollable body -->
  <div class="flex flex-col flex-1 overflow-y-auto">
    <!-- Metadata region -->
    <div class="flex flex-col gap-4 px-8 pt-6 pb-4 w-full mx-auto">
      <!-- Title -->
      <Input
        bind:value={title}
        placeholder="Untitled Article"
        class="text-2xl font-bold h-auto p-2 border-0 border-b border-border/60 rounded-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-primary/50 placeholder:text-muted-foreground/35 transition-colors"
        oninput={() => (isDirty = true)}
      />

      <!-- Context + Tags row -->
      <div class="flex items-start gap-4 w-full flex-wrap">
        <!-- Context -->
        <div class="flex items-center gap-2 w-130">
          <span class="text-xs text-muted-foreground uppercase shrink-0"> Primary </span>
          <div class="w-full">
            <SingleSelect bind:selected={contextId} options={contextOptions} />
          </div>
        </div>

        <Separator orientation="vertical" class="h-4 hidden sm:block" />

        <div class="flex items-center gap-2 w-96">
          <span class="text-xs text-muted-foreground uppercase shrink-0"> Linked </span>
          <div class="w-full">
            <MultiSelect
              bind:selected={linkedContextIds}
              options={linkedContextOptions}
              placeholder="Linked contexts"
              maxDisplay={1}
              searchPlaceholder="Search contexts..."
              onchange={() => (isDirty = true)}
            />
          </div>
        </div>

        <Separator orientation="vertical" class="h-4 hidden sm:block" />

        <!-- Tags -->
        <div class="flex items-center gap-2 w-72">
          <span class="text-xs text-muted-foreground uppercase tracking-wide shrink-0 font-medium">
            Tags
          </span>
          <div class="w-full">
            <MultiSelect
              bind:selected={tagIds}
              options={tagOptions}
              placeholder="Choose tags"
              maxDisplay={2}
              searchPlaceholder="Search tags..."
              onchange={() => (isDirty = true)}
            />
          </div>
        </div>
      </div>
    </div>

    <Separator class="w-full" />

    <!-- Editor region -->
    <div class="flex flex-1 w-full mx-auto min-h-96">
      <RichEditor bind:html={bodyHtml} onchange={() => (isDirty = true)} />
    </div>
  </div>
</div>
