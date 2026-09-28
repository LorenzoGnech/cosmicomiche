import { scoreAnswer } from "./score";
import { BAND_LABEL, bandForScore, MAX_SCORE, maxElapsedMs } from "./tiers";
import type { Debrief } from "./api-types";
import type { StartPayload } from "./token";
import type { Prompt } from "./types";

export function buildDebrief(date: string, prompts: Prompt[], rawAnswers: string[]): Debrief {
  const rows = prompts.map((prompt, index) => {
    const answer = rawAnswers[index] ?? "";
    const hit = scoreAnswer(answer, prompt.answers);
    return {
      id: prompt.id,
      text: prompt.text,
      answer,
      tier: hit.tier,
      label: hit.label,
      points: hit.points,
      canonical: hit.canonical,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.points, 0);
  const band = bandForScore(total);
  return {
    date,
    total,
    max: MAX_SCORE,
    band,
    bandLabel: BAND_LABEL[band],
    singularity: rows.some((row) => row.tier === "singolarita"),
    rows,
  };
}

export function sessionError(
  payload: StartPayload,
  now: number,
  today: string,
  scheduledIds: string[],
): string | null {
  if (payload.date !== today) return "Sessione scaduta";
  if (payload.promptIds.join("|") !== scheduledIds.join("|")) return "Sessione scaduta";
  const elapsed = now - payload.startedAt;
  if (elapsed < -2_000 || elapsed > maxElapsedMs()) return elapsed > maxElapsedMs() ? "Tempo scaduto" : "Sessione scaduta";
  return null;
}
