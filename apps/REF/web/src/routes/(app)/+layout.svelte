<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  const { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<div class="app-shell">
  <nav class="sidebar">
    <div class="sidebar-brand">
      <span class="brand-name">MSPByte</span>
    </div>
    <ul class="nav-links">
      <li><a href="/dashboard">Dashboard</a></li>
      <li><a href="/sites">Sites</a></li>
      <li><a href="#">Devices</a></li>
      <li><a href="#">Identities</a></li>
      <li><a href="#">Compliance</a></li>
    </ul>
    {#if data.user}
      <div class="sidebar-user">{data.user.emailAddresses?.[0]?.emailAddress}</div>
    {/if}
  </nav>

  <main class="main-content">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 220px;
    background: #1a1a2e;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
    flex-shrink: 0;
  }

  .brand-name {
    font-weight: 700;
    font-size: 1.2rem;
    color: #fff;
  }

  .nav-links {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-links a {
    display: block;
    padding: 0.5rem 0.75rem;
    color: #b0b0c0;
    text-decoration: none;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .nav-links a:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .sidebar-user {
    margin-top: auto;
    font-size: 0.75rem;
    color: #888;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .main-content {
    flex: 1;
    padding: 2rem;
    background: #f7f8fa;
    overflow-y: auto;
  }
</style>
