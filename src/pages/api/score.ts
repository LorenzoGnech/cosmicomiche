import type { APIRoute } from "astro";
import { MAX_ANSWER_LENGTH, PROMPT_COUNT } from "../../lib/tiers";
import { buildDebrief, sessionError } from "../../lib/debrief";
import { romeDate } from "../../lib/rome";
import { verifyPayload } from "../../lib/token";
import { readDebrief, storeDebrief, todayPrompts } from "../../server/session";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const today = romeDate();
  const done = readDebrief(cookies, today);
  if (done) return json({ status: "done", debrief: done });

  const body = await request.json().catch(() => null) as { token?: unknown; answers?: unknown } | null;
  const token = body?.token;
  const answers = body?.answers;
  if (typeof token !== "string" || !Array.isArray(answers) || answers.length !== PROMPT_COUNT) {
    return json({ error: "Richiesta non valida" }, 400);
  }
  if (!answers.every((answer) => typeof answer === "string" && answer.length <= MAX_ANSWER_LENGTH)) {
    return json({ error: "Richiesta non valida" }, 400);
  }

  const payload = verifyPayload(token);
  const { prompts, missing } = todayPrompts(today);
  if (!payload || missing) return json({ error: "Sessione scaduta" }, 400);
  const reason = sessionError(
    payload,
    Date.now(),
    today,
    prompts.map((prompt) => prompt.id),
  );
  if (reason) return json({ error: reason }, 400);

  const debrief = buildDebrief(
    today,
    prompts,
    answers.map((answer) => answer.trim()),
  );
  storeDebrief(cookies, debrief);
  return json({ status: "done", debrief });
};
