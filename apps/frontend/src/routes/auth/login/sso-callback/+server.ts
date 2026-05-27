import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  console.log("[SSO]", locals.auth().userId);

  return redirect(303, "/home");
};
