import type { APIRoute } from "astro";
import { START_COOKIE, type DiveState, type PromptCard } from "../../lib/api-types";
import { romeDate } from "../../lib/rome";
import { emptyLocks } from "../../lib/playhead";
import { signPayload, type StartPayload } from "../../lib/token";
import type { Prompt } from "../../lib/types";
import { cookieOptions, matchingStart, readDebrief, todayPrompts } from "../../server/session";

export const prerender = false;

function json(data: DiveState, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function cards(prompts: Prompt[]): PromptCard[] {
  return prompts.map((prompt) => ({ id: prompt.id, text: prompt.text }));
}

function playing(
  date: string,
  startedAt: number,
  token: string,
  prompts: Prompt[],
  lockedAt: (number | null)[],
): DiveState {
  return { status: "playing", date, startedAt, prompts: cards(prompts), token, lockedAt };
}

export const GET: APIRoute = ({ cookies }) => {
  const today = romeDate();
  const done = readDebrief(cookies, today);
  if (done) return json({ status: "done", debrief: done });
  const { prompts, missing } = todayPrompts(today);
  if (missing) return json({ status: "empty", date: today });
  const active = matchingStart(cookies, today, prompts);
  if (active) return json(playing(today, active.payload.startedAt, active.token, prompts, active.payload.lockedAt));
  return json({ status: "ready", date: today });
};

export const POST: APIRoute = ({ cookies }) => {
  const today = romeDate();
  const done = readDebrief(cookies, today);
  if (done) return json({ status: "done", debrief: done });
  const { prompts, missing } = todayPrompts(today);
  if (missing) return json({ status: "empty", date: today });
  const active = matchingStart(cookies, today, prompts);
  if (active) return json(playing(today, active.payload.startedAt, active.token, prompts, active.payload.lockedAt));
  const payload: StartPayload = {
    date: today,
    startedAt: Date.now(),
    promptIds: prompts.map((prompt) => prompt.id),
    lockedAt: emptyLocks(),
  };
  const token = signPayload(payload);
  cookies.set(START_COOKIE, token, cookieOptions());
  return json(playing(today, payload.startedAt, token, prompts, payload.lockedAt));
};
