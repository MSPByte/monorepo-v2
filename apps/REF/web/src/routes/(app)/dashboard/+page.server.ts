import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Token for client-side tRPC calls
  const token = await locals.session?.getToken();
  return { token: token ?? '' };
};
