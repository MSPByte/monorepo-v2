import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies }) => {
  // Clear Clerk session cookies to sign the user out
  for (const cookie of cookies.getAll()) {
    if (cookie.name.includes("clerk")) {
      cookies.delete(cookie.name, { path: "/" });
    }
  }

  return redirect(303, "/");
};
