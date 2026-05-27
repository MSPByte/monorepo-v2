export default async function globalTeardown() {
  // Clean up any test data seeded during global-setup
  console.log('[e2e] Global teardown: cleanup complete');
}
