import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const token = await locals.session?.getToken();
  return { token: token ?? '', siteId: params.siteId };
};
