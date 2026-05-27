<script lang="ts">
  import { SignUp } from 'svelte-clerk';
</script>

<svelte:head>
  <title>Sign up — MSPByte</title>
</svelte:head>

<div class="auth-container">
  <SignUp />
</div>

<style>
  .auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
  }
</style>
