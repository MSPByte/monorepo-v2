<script lang="ts">
  import { SignIn } from 'svelte-clerk';
</script>

<svelte:head>
  <title>Sign in — MSPByte</title>
</svelte:head>

<div class="auth-container">
  <SignIn />
</div>

<style>
  .auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
  }
</style>
