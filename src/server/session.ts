import type { AstroCookies } from "astro";
import { RESULT_COOKIE, START_COOKIE, type Debrief } from "../lib/api-types";
import { loadPrompts, loadSchedule } from "../lib/bank";
import { romeDate, secondsUntilNextRomeMidnight } from "../lib/rome";
import { verifyPayload } from "../lib/token";
import type { Prompt } from "../lib/types";

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: secondsUntilNextRomeMidnight(),
    secure: process.env.NODE_ENV === "production",
  };
}

export function readDebrief(cookies: AstroCookies, today = romeDate()): Debrief | null {
  const raw = cookies.get(RESULT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Debrief;
    if (!parsed || parsed.date !== today || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeDebrief(cookies: AstroCookies, debrief: Debrief): void {
  cookies.set(RESULT_COOKIE, Buffer.from(JSON.stringify(debrief)).toString("base64url"), cookieOptions());
  cookies.delete(START_COOKIE, { path: "/" });
}

export function todayPrompts(today = romeDate()): { prompts: Prompt[]; missing: boolean } {
  const day = loadSchedule().days.find((entry) => entry.date === today);
  if (!day) return { prompts: [], missing: true };
  const byId = new Map(loadPrompts().map((prompt) => [prompt.id, prompt]));
  const prompts = day.promptIds
    .map((id) => byId.get(id))
    .filter((prompt): prompt is Prompt => Boolean(prompt));
  if (prompts.length !== day.promptIds.length) return { prompts: [], missing: true };
  return { prompts, missing: false };
}

export function matchingStart(cookies: AstroCookies, today: string, prompts: Prompt[]) {
  const token = cookies.get(START_COOKIE)?.value;
  const payload = token ? verifyPayload(token) : null;
  if (!token || !payload) return null;
  if (payload.date !== today) return null;
  if (payload.promptIds.join("|") !== prompts.map((prompt) => prompt.id).join("|")) return null;
  return { token, payload };
}
