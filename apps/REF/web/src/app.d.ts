// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    interface Locals {
      session: import('@clerk/backend').Session | null;
      user: import('@clerk/backend').User | null;
    }
  }
}

export {};
