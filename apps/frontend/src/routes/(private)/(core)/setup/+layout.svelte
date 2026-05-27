<script lang="ts">
  import UrlTabs from '$lib/components/url-tabs.svelte';

  const { children } = $props();

  const tabs = [
    { href: '/setup/users', label: 'Users' },
    { href: '/setup/roles', label: 'Roles' },
    { href: '/setup/integrations', label: 'Integrations' },
    { href: '/setup/pipeline', label: 'Pipeline' },
  ];
</script>

<div class="flex flex-col size-full overflow-hidden">
  <UrlTabs {tabs} />
  <div class="flex-1 overflow-hidden">
    {@render children()}
  </div>
</div>
