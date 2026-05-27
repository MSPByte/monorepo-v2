import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@mspbyte/trpc';

// CRITICAL: AppRouter is imported as a type only — no server-side implementation
// is bundled into the client. Never change this to a runtime import.

export function createTrpcClient(token: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3000'}/trpc`,
        headers: () => ({ Authorization: `Bearer ${token}` }),
      }),
    ],
  });
}
