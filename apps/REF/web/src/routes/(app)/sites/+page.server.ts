import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const token = await locals.session?.getToken();
  return { token: token ?? '' };
};
