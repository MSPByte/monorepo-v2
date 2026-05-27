<script lang="ts">
  import { authStore } from '$lib/stores/auth.store.svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import { Power, Sun, Moon } from '@lucide/svelte';
  import { toggleMode, mode } from 'mode-watcher';
  import { useClerkContext } from 'svelte-clerk';

  const ctx = useClerkContext();

  function handleLogout() {
    authStore.logout(() => ctx.clerk?.signOut({ redirectUrl: '/' }));
  }

  const initials = $derived(
    authStore.currentUser
      ? authStore.currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      : 'AA'
  );
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <div
      class="flex rounded-full bg-primary items-center justify-center w-8 h-8 text-sm hover:cursor-pointer hover:bg-primary/70 text-primary-foreground"
    >
      {initials}
    </div>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Group>
      <DropdownMenu.Label>
        {authStore.currentUser?.name}
      </DropdownMenu.Label>
      <DropdownMenu.Item class="flex justify-between" onclick={toggleMode} closeOnSelect={false}>
        <div class="flex items-center gap-2">
          {#if mode.current === 'dark'}
            <Moon class="h-4 w-4" />
            Dark Mode
          {:else}
            <Sun class="h-4 w-4" />
            Light Mode
          {/if}
        </div>
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item onclick={handleLogout} class="flex gap-2 text-destructive hover:text-destructive">
        <Power class="h-4 w-4" /> Logout
      </DropdownMenu.Item>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
