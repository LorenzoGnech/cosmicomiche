import type { APIRoute } from "astro";
import { RESULT_COOKIE, START_COOKIE, type DiveState } from "../../lib/api-types";
import { romeDate } from "../../lib/rome";

export const prerender = false;

export const POST: APIRoute = ({ cookies }) => {
  if (!import.meta.env.DEV) return new Response(null, { status: 404 });
  cookies.delete(START_COOKIE, { path: "/" });
  cookies.delete(RESULT_COOKIE, { path: "/" });
  const body: DiveState = { status: "ready", date: romeDate() };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
};
