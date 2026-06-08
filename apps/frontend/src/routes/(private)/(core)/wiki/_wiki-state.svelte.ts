import {
  MOCK_CATEGORIES,
  MOCK_ARTICLES,
  MOCK_TAGS,
  MOCK_OVERRIDES,
  type WikiCategory,
  type WikiArticle,
  type WikiTag,
  type WikiOverride,
  getAllDescendantIds,
} from './_mock-data.js';

function createWikiState() {
  let searchOpen = $state(false);
  let categories = $state<WikiCategory[]>([...MOCK_CATEGORIES]);
  let articles = $state<Record<string, WikiArticle>>({ ...MOCK_ARTICLES });
  let tags = $state<Record<string, WikiTag>>({ ...MOCK_TAGS });
  let overrides = $state<WikiOverride[]>([...MOCK_OVERRIDES]);

  function nextArticleId() {
    const max = Object.keys(articles).reduce((acc, id) => {
      const match = id.match(/^KB(\d+)$/);
      return match ? Math.max(acc, Number(match[1])) : acc;
    }, 0);
    return `KB${String(max + 1).padStart(3, '0')}`;
  }

  return {
    get searchOpen() {
      return searchOpen;
    },
    set searchOpen(v: boolean) {
      searchOpen = v;
    },
    get categories() {
      return categories;
    },
    get contexts() {
      return categories;
    },
    get articles() {
      return articles;
    },
    get articleList() {
      return Object.values(articles);
    },
    get tags() {
      return tags;
    },
    get tagList() {
      return Object.values(tags);
    },
    get overrides() {
      return overrides;
    },

    openSearch() {
      searchOpen = true;
    },
    closeSearch() {
      searchOpen = false;
    },

    addCategory(cat: WikiCategory) {
      categories = [...categories, cat];
    },
    addContext(ctx: WikiCategory) {
      categories = [...categories, ctx];
    },
    updateCategory(id: string, patch: Partial<WikiCategory>) {
      categories = categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
    },
    removeCategory(id: string) {
      const removedIds = getAllDescendantIds(id, categories);
      const removed = categories.find((c) => c.id === id);
      const remaining = categories.filter((c) => !removedIds.includes(c.id));
      const fallbackContextId =
        removed?.parent_id && remaining.some((c) => c.id === removed.parent_id)
          ? removed.parent_id
          : (remaining.find((c) => c.parent_id === null)?.id ?? '');

      categories = remaining;
      articles = Object.fromEntries(
        Object.entries(articles).map(([articleId, article]) => [
          articleId,
          {
            ...article,
            primary_context_id: removedIds.includes(article.primary_context_id)
              ? fallbackContextId
              : article.primary_context_id,
            linked_context_ids: article.linked_context_ids.filter((contextId) => !removedIds.includes(contextId)),
          },
        ])
      );
    },

    addTag(tag: WikiTag) {
      tags = { ...tags, [tag.id]: tag };
    },
    updateTag(id: string, patch: Partial<WikiTag>) {
      tags = { ...tags, [id]: { ...tags[id], ...patch } };
    },
    removeTag(id: string) {
      tags = Object.fromEntries(Object.entries(tags).filter(([k]) => k !== id));
      articles = Object.fromEntries(
        Object.entries(articles).map(([articleId, article]) => [
          articleId,
          { ...article, tag_ids: article.tag_ids.filter((tagId) => tagId !== id) },
        ])
      );
    },

    upsertArticle(article: Omit<WikiArticle, 'id'> & { id?: string }) {
      const id = article.id && article.id !== 'new' ? article.id : nextArticleId();
      const nextArticle: WikiArticle = {
        ...article,
        id,
      };
      articles = { ...articles, [id]: nextArticle };
      return nextArticle;
    },

    removeArticle(id: string) {
      articles = Object.fromEntries(Object.entries(articles).filter(([articleId]) => articleId !== id));
      overrides = overrides.filter((override) => override.article_id !== id);
    },

    upsertOverride(override: Partial<WikiOverride> & { article_id: string; site_id: string }) {
      const siteName = override.site_name ?? override.site_id;
      const id = override.id ?? `ov-${override.article_id}-${override.site_id}-${Date.now()}`;
      const nextOverride: WikiOverride = {
        id,
        article_id: override.article_id,
        site_id: override.site_id,
        site_name: siteName,
        title: override.title ?? 'Untitled override',
        content: override.content ?? '<p></p>',
        type: override.type ?? 'addendum',
        locked_by: override.locked_by ?? null,
        locked_at: override.locked_at ?? null,
        updated_at: new Date().toISOString(),
      };

      const exists = overrides.some((item) => item.id === id);
      overrides = exists
        ? overrides.map((item) => (item.id === id ? nextOverride : item))
        : [...overrides, nextOverride];
      return nextOverride;
    },

    removeOverride(id: string) {
      overrides = overrides.filter((override) => override.id !== id);
    },
  };
}

export const wikiState = createWikiState();
