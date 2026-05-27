import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
