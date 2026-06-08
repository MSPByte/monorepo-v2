<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Badge from '$lib/components/ui/badge/badge.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import Input from '$lib/components/ui/input/input.svelte';
  import Separator from '$lib/components/ui/separator/separator.svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Check from '@lucide/svelte/icons/check';
  import Clock from '@lucide/svelte/icons/clock';
  import FileText from '@lucide/svelte/icons/file-text';
  import Folder from '@lucide/svelte/icons/folder';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import Link from '@lucide/svelte/icons/link';
  import Lock from '@lucide/svelte/icons/lock';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import X from '@lucide/svelte/icons/x';

  import { wikiState } from '../../_wiki-state.svelte.js';
  import {
    getArticleCount,
    getArticlesForContext,
    getContextChildren,
    getContextPath,
    getLinkedArticleCount,
  } from '../../_mock-data.js';
  import SingleSelect from '$lib/components/single-select.svelte';

  const contextId = $derived(page.params.id ?? '');

  const context = $derived(wikiState.contexts.find((c) => c.id === contextId));
  const breadcrumb = $derived(contextId ? getContextPath(contextId, wikiState.contexts) : []);
  const childContexts = $derived(
    contextId ? getContextChildren(contextId, wikiState.contexts) : []
  );
  const contextArticles = $derived(
    contextId ? getArticlesForContext(contextId, wikiState.articleList) : []
  );
  const primaryArticles = $derived(contextArticles.filter((a) => a.context_role === 'primary'));
  const linkedArticles = $derived(contextArticles.filter((a) => a.context_role === 'linked'));

  const siblingContexts = $derived.by(() => {
    if (!context) return [];
    return getContextChildren(context.parent_id, wikiState.contexts);
  });

  let addingChildContext = $state(false);
  let newContextName = $state('');
  let newContextDescription = $state('');

  function addChildContext() {
    const label = newContextName.trim();
    if (!label) return;
    wikiState.addContext({
      id: `ctx-${label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}-${Date.now()}`,
      label,
      description: newContextDescription.trim() || undefined,
      parent_id: contextId,
    });
    addingChildContext = false;
    newContextName = '';
    newContextDescription = '';
  }

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  function parentHref() {
    if (!context?.parent_id) return '/wiki';
    return `/wiki/category/${context.parent_id}`;
  }
</script>

{#if !context}
  <div class="flex size-full items-center justify-center text-muted-foreground">
    Context not found
  </div>
{:else}
  <div class="flex size-full flex-col overflow-y-auto">
    <div class="flex shrink-0 flex-col gap-4 px-6 pb-4 pt-5">
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <Button variant="ghost" size="icon-sm" href={parentHref()} title="Back">
          <ArrowLeft class="size-4" />
        </Button>
        <a href="/wiki" class="transition-colors hover:text-foreground">Contexts</a>
        {#each breadcrumb as crumb, i (crumb.id)}
          <ChevronRight class="size-3" />
          {#if i === breadcrumb.length - 1}
            <span class="font-medium text-foreground">{crumb.label}</span>
          {:else}
            <a href="/wiki/category/{crumb.id}" class="transition-colors hover:text-foreground">
              {crumb.label}
            </a>
          {/if}
        {/each}
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="flex min-w-0 items-start gap-3">
          <div class="rounded-lg bg-primary/10 p-2.5 text-primary">
            <FolderOpen class="size-5" />
          </div>
          <div class="min-w-0">
            <h1 class="text-xl font-semibold">{context.label}</h1>
            {#if context.description}
              <p class="mt-0.5 text-sm text-muted-foreground">{context.description}</p>
            {/if}
            <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span
                >{primaryArticles.length} home article{primaryArticles.length === 1
                  ? ''
                  : 's'}</span
              >
              <span
                >{linkedArticles.length} linked appearance{linkedArticles.length === 1
                  ? ''
                  : 's'}</span
              >
              <span
                >{childContexts.length} child context{childContexts.length === 1 ? '' : 's'}</span
              >
            </div>
          </div>
        </div>

        <div class="flex w-fit items-center gap-2">
          {#if siblingContexts.length > 1}
            <div class="w-44">
              <SingleSelect
                options={siblingContexts.map((sc) => ({ label: sc.label, value: sc.id }))}
                selected={context.id}
                onchange={(v) => goto(`/wiki/category/${v}`)}
              />
            </div>
          {/if}
          <Button
            variant="outline"
            size="sm"
            class="gap-1.5"
            onclick={() => (addingChildContext = true)}
          >
            <Folder class="size-3.5" />
            New Context
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
                <AlertDialog.Title>Delete {context.label}?</AlertDialog.Title>
                <AlertDialog.Description>
                  This removes this context and any child contexts from the mock. Articles are moved
                  to a remaining parent or root context, and linked appearances are removed.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action
                  class="bg-destructive text-destructive-foreground hover:bg-destructive/80"
                  onclick={() => {
                    const target = parentHref();
                    wikiState.removeCategory(context.id);
                    goto(target);
                  }}
                >
                  Delete
                </AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog.Root>
          <Button href="/wiki/create/new?context={contextId}" size="sm" class="gap-1.5">
            <Plus class="size-3.5" />
            New Article
          </Button>
        </div>
      </div>
    </div>

    <Separator />

    <div class="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section class="min-w-0 space-y-6">
        <div>
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Drill Down
          </h2>
          {#if addingChildContext}
            <div class="mb-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <div class="grid gap-2 sm:grid-cols-[16rem_minmax(0,1fr)_auto]">
                <Input bind:value={newContextName} placeholder="Context name" class="h-8" />
                <Input
                  bind:value={newContextDescription}
                  placeholder="Short description"
                  class="h-8"
                  onkeydown={(e) => {
                    if (e.key === 'Enter') addChildContext();
                  }}
                />
                <div class="flex items-center gap-1">
                  <Button size="icon-sm" title="Create context" onclick={addChildContext}>
                    <Check class="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Cancel"
                    onclick={() => {
                      addingChildContext = false;
                      newContextName = '';
                      newContextDescription = '';
                    }}
                  >
                    <X class="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          {/if}
          {#if childContexts.length > 0}
            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {#each childContexts as child (child.id)}
                {@const childCount = getContextChildren(child.id, wikiState.contexts).length}
                {@const homeCount = getArticleCount(child.id, wikiState.articleList)}
                {@const linkedCount = getLinkedArticleCount(child.id, wikiState.articleList)}
                <a
                  href="/wiki/category/{child.id}"
                  class="group flex min-h-28 flex-col gap-3 rounded-lg border bg-card/60 p-4 transition-colors hover:border-primary/30 hover:bg-primary/10"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <span
                        class="rounded-md bg-muted p-1.5 text-muted-foreground group-hover:text-primary"
                      >
                        <Folder class="size-4" />
                      </span>
                      <div>
                        <h3 class="text-sm font-medium">{child.label}</h3>
                        <p class="text-xs text-muted-foreground">
                          {childCount} child context{childCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight
                      class="size-4 text-muted-foreground opacity-0 group-hover:opacity-100"
                    />
                  </div>
                  <div class="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{homeCount} home</span>
                    {#if linkedCount > 0}
                      <span>{linkedCount} linked</span>
                    {/if}
                  </div>
                </a>
              {/each}
            </div>
          {:else}
            <div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No child contexts. Articles in this context appear below.
            </div>
          {/if}
        </div>

        <div>
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Articles In This Context
          </h2>
          {#if contextArticles.length > 0}
            <div class="space-y-2">
              {#each contextArticles as article (article.id)}
                <a
                  href="/wiki/{article.id}"
                  class="group flex items-center gap-3 rounded-lg border bg-card/60 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/10"
                >
                  <FileText class="size-4 shrink-0 text-muted-foreground" />
                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="truncate text-sm font-medium group-hover:text-primary">
                        {article.title}
                      </span>
                      {#if article.context_role === 'linked'}
                        <Badge variant="outline" class="gap-1 px-1.5 py-0 text-xs">
                          <Link class="size-3" />
                          linked
                        </Badge>
                      {/if}
                    </div>
                    <p class="truncate text-xs text-muted-foreground">
                      {article.id} · {article.author}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    {#each article.tag_ids.slice(0, 2) as tid (tid)}
                      {@const tag = wikiState.tags[tid]}
                      {#if tag}
                        <span
                          class="rounded-full px-1.5 py-0 text-xs"
                          style="background-color: {tag.color}18; color: {tag.color}"
                        >
                          {tag.label}
                        </span>
                      {/if}
                    {/each}
                    {#if article.locked_by}
                      <span title="Locked by {article.locked_by}">
                        <Lock class="size-3.5 text-warning" />
                      </span>
                    {/if}
                    <span class="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock class="size-3" />
                      {relativeTime(article.updated_at)}
                    </span>
                  </div>
                </a>
              {/each}
            </div>
          {:else}
            <div class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No articles are currently home or linked here.
            </div>
          {/if}
        </div>
      </section>

      <aside class="min-w-0 space-y-4">
        <div class="rounded-lg border bg-card/50 p-4">
          <h2 class="text-sm font-semibold">Context Rules</h2>
          <div class="mt-3 space-y-3 text-sm">
            <div>
              <p class="font-medium">Primary Context</p>
              <p class="text-xs text-muted-foreground">
                The article's home. It controls the default breadcrumb and where the doc is managed.
              </p>
            </div>
            <div>
              <p class="font-medium">Linked Appearance</p>
              <p class="text-xs text-muted-foreground">
                The same article appears here because a technician may reasonably look here too.
              </p>
            </div>
            <div>
              <p class="font-medium">Tags</p>
              <p class="text-xs text-muted-foreground">
                Tags describe work type and traits, not where a doc lives.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
{/if}
