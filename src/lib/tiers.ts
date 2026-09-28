import type { TierId } from "./types";

export const TIER_POINTS: Record<TierId, number> = {
  atmosfera: 10,
  orbita: 30,
  luna: 55,
  vuoto: 80,
  singolarita: 100,
};

export const TIER_LABEL: Record<TierId, string> = {
  atmosfera: "Atmosfera",
  orbita: "Orbita",
  luna: "Luna",
  vuoto: "Vuoto",
  singolarita: "Singolarità",
};

export const MISS_LABEL = "Fuori rotta";

export const MIN_ANSWERS: Record<TierId, number> = {
  atmosfera: 5,
  orbita: 4,
  luna: 3,
  vuoto: 2,
  singolarita: 1,
};

export const PROMPT_COUNT = 5;
export const PROMPT_MS = 30_000;
export const TRANSIT_MS = 3_000;
export const GAP_MS = TRANSIT_MS;
export const MAX_ANSWER_LENGTH = 80;
export const SCORE_GRACE_MS = 15_000;
export const MAX_SCORE = PROMPT_COUNT * TIER_POINTS.singolarita;

export type BandId = "atmosfera" | "orbita" | "luna" | "vuoto" | "interstellare";

export const BAND_LABEL: Record<BandId, string> = {
  atmosfera: "Ancora in atmosfera",
  orbita: "Orbita bassa",
  luna: "Fino alla Luna",
  vuoto: "Vuoto del sistema",
  interstellare: "Spazio interstellare",
};

export function bandForScore(total: number): BandId {
  if (total <= 50) return "atmosfera";
  if (total <= 150) return "orbita";
  if (total <= 275) return "luna";
  if (total <= 400) return "vuoto";
  return "interstellare";
}

export function maxElapsedMs(): number {
  return PROMPT_COUNT * (PROMPT_MS + TRANSIT_MS) + SCORE_GRACE_MS;
}
