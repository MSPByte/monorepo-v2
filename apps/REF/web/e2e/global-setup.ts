// Clerk e2e testing requires Clerk's test mode.
// Enable it in your Clerk dashboard under "Testing tokens".
// This setup connects to the test DB and seeds a test user.
// Use Clerk's test user feature: https://clerk.com/docs/testing/playwright
//
// Set in your .env.test:
//   CLERK_SECRET_KEY=sk_test_...
//   PLAYWRIGHT_TEST_USER_EMAIL=...
//   PLAYWRIGHT_TEST_USER_PASSWORD=...
//   TEST_MSP_DATABASE_URL=...

export default async function globalSetup() {
  console.log('[e2e] Global setup: using Clerk test mode');
  // Seed test data here if needed using TEST_MSP_DATABASE_URL
}
