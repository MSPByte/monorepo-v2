<script lang="ts">
  import type { Snippet } from 'svelte';
  import { wikiState } from './_wiki-state.svelte.js';
  import { getContextPath } from './_mock-data.js';

  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();

  let wrapperEl = $state<HTMLDivElement | undefined>();
  let activeKbId = $state<string | null>(null);
  let popoverX = $state(0);
  let popoverY = $state(0);

  const activeArticle = $derived(activeKbId ? (wikiState.articles[activeKbId] ?? null) : null);
  const contextPath = $derived(
    activeArticle ? getContextPath(activeArticle.primary_context_id, wikiState.contexts) : []
  );

  function positionNear(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    // Clamp horizontally so the 256px-wide popover stays on screen
    popoverX = Math.min(rect.left, window.innerWidth - 272);
    popoverY = rect.bottom + 6;
  }

  $effect(() => {
    const wrapper = wrapperEl;
    if (!wrapper) return;

    function onMouseOver(e: MouseEvent) {
      const target = (e.target as Element).closest('[data-kb-id]') as HTMLElement | null;
      if (target) {
        activeKbId = target.dataset.kbId ?? null;
        positionNear(target);
      }
    }

    function onClick(e: MouseEvent) {
      const target = (e.target as Element).closest('[data-kb-id]') as HTMLElement | null;
      if (target?.dataset.kbId) {
        e.preventDefault();
        window.open(`/wiki/${target.dataset.kbId}`, '_blank', 'noopener,noreferrer');
      }
    }

    function onMouseOut(e: MouseEvent) {
      const related = e.relatedTarget as Element | null;
      if (!related?.closest('[data-kb-id]') && !related?.closest('.kb-popover')) {
        activeKbId = null;
      }
    }

    // Close on any scroll in the document (capture catches overflow scroll too)
    function onScroll() {
      activeKbId = null;
    }

    wrapper.addEventListener('mouseover', onMouseOver);
    wrapper.addEventListener('mouseout', onMouseOut);
    wrapper.addEventListener('click', onClick);
    document.addEventListener('scroll', onScroll, { capture: true });

    return () => {
      wrapper.removeEventListener('mouseover', onMouseOver);
      wrapper.removeEventListener('mouseout', onMouseOut);
      wrapper.removeEventListener('click', onClick);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  });
</script>

<div bind:this={wrapperEl} style="display: contents">
  {@render children()}
</div>

{#if activeArticle}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="kb-popover fixed z-50 w-64 rounded-lg border bg-popover text-popover-foreground shadow-lg p-3 flex flex-col gap-2"
    style="left: {popoverX}px; top: {popoverY}px;"
    onmouseleave={(e) => {
      const related = e.relatedTarget as Element | null;
      if (!related?.closest('[data-kb-id]')) activeKbId = null;
    }}
  >
    <!-- ID + Title -->
    <div class="flex items-start gap-2">
      <span
        class="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 mt-0.5"
      >
        {activeArticle.id}
      </span>
      <p class="text-sm font-semibold leading-tight">{activeArticle.title}</p>
    </div>

    <!-- Context breadcrumb -->
    {#if contextPath.length > 0}
      <div class="flex items-center gap-1 flex-wrap">
        {#each contextPath as cat, i (cat.id)}
          {#if i > 0}
            <ChevronRight class="size-2.5 text-muted-foreground/50 shrink-0" />
          {/if}
          <span class="text-xs text-muted-foreground">{cat.label}</span>
        {/each}
      </div>
    {/if}

    <!-- Tags -->
    {#if activeArticle.tag_ids.length > 0}
      <div class="flex gap-1 flex-wrap">
        {#each activeArticle.tag_ids.slice(0, 3) as tid (tid)}
          {@const tag = wikiState.tags[tid]}
          <span
            class="text-xs px-1.5 py-0 rounded-full border"
            style={tag
              ? `background-color: ${tag.color}18; color: ${tag.color}; border-color: ${tag.color}30`
              : ''}
          >
            {tag?.label ?? tid}
          </span>
        {/each}
        {#if activeArticle.tag_ids.length > 3}
          <span class="text-xs text-muted-foreground">+{activeArticle.tag_ids.length - 3}</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}
