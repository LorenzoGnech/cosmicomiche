import type { APIRoute } from "astro";
import type { LockResult } from "../../lib/api-types";
import { START_COOKIE } from "../../lib/api-types";
import { sessionError } from "../../lib/debrief";
import { emptyLocks, playhead } from "../../lib/playhead";
import { romeDate } from "../../lib/rome";
import { scoreAnswer } from "../../lib/score";
import { MAX_ANSWER_LENGTH, PROMPT_COUNT } from "../../lib/tiers";
import { signPayload, verifyPayload } from "../../lib/token";
import { cookieOptions, readDebrief, todayPrompts } from "../../server/session";

export const prerender = false;

function json(data: LockResult | { error: string }, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const today = romeDate();
  if (readDebrief(cookies, today)) return json({ error: "Missione già compiuta" }, 400);

  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    index?: unknown;
    answer?: unknown;
  } | null;
  const token = body?.token;
  const index = body?.index;
  const answer = body?.answer;
  if (typeof token !== "string" || typeof answer !== "string" || typeof index !== "number") {
    return json({ error: "Richiesta non valida" }, 400);
  }
  if (!Number.isInteger(index) || index < 0 || index >= PROMPT_COUNT || answer.length > MAX_ANSWER_LENGTH) {
    return json({ error: "Richiesta non valida" }, 400);
  }

  const payload = verifyPayload(token);
  const { prompts, missing } = todayPrompts(today);
  if (!payload || missing) return json({ error: "Sessione scaduta" }, 400);
  const now = Date.now();
  const reason = sessionError(
    payload,
    now,
    today,
    prompts.map((prompt) => prompt.id),
  );
  if (reason) return json({ error: reason }, 400);

  const lockedAt = (payload.lockedAt ?? emptyLocks()).slice();
  const phase = playhead(payload.startedAt, now, lockedAt);
  const open = (phase.phase === "prompt" || phase.phase === "gap") && phase.index === index;
  if (!open || payload.promptIds[index] !== prompts[index]?.id) {
    return json({ error: "Fuori tempo" }, 400);
  }
  if (phase.phase === "prompt" && lockedAt[index] == null) lockedAt[index] = now;

  const nextToken = signPayload({ ...payload, lockedAt });
  cookies.set(START_COOKIE, nextToken, cookieOptions());
  const hit = scoreAnswer(answer, prompts[index].answers);
  return json({
    token: nextToken,
    lockedAt,
    peek: {
      answer: answer.trim(),
      tier: hit.tier,
      label: hit.label,
      points: hit.points,
      canonical: hit.canonical,
    },
  });
};
