import { contentTokens, normalize, withinOneEdit } from "./normalize";
import { MISS_LABEL, TIER_LABEL, TIER_POINTS } from "./tiers";
import type { Answer, TierId } from "./types";

export type ScoreHit = {
  tier: TierId | null;
  points: number;
  label: string;
  canonical: string | null;
};

type CatalogEntry = {
  tier: TierId;
  canonical: string;
  keys: string[];
  tokenSets: Set<string>[];
};

function miss(): ScoreHit {
  return { tier: null, points: 0, label: MISS_LABEL, canonical: null };
}

function hit(entry: CatalogEntry): ScoreHit {
  return {
    tier: entry.tier,
    points: TIER_POINTS[entry.tier],
    label: TIER_LABEL[entry.tier],
    canonical: entry.canonical,
  };
}

export function answerKeys(answer: Answer): string[] {
  const keys = [answer.canonical, ...(answer.aliases ?? [])].map(normalize).filter(Boolean);
  return [...new Set(keys)];
}

function catalog(answers: Answer[]): CatalogEntry[] {
  return answers.map((answer) => {
    const keys = answerKeys(answer);
    const surfaces = [answer.canonical, ...(answer.aliases ?? [])];
    return {
      tier: answer.tier,
      canonical: answer.canonical,
      keys,
      tokenSets: surfaces.map((surface) => new Set(contentTokens(surface))).filter((set) => set.size > 0),
    };
  });
}

function covers(typed: Set<string>, answer: Set<string>): boolean {
  if (typed.size === 0 || typed.size > answer.size) return false;
  for (const token of typed) if (!answer.has(token)) return false;
  return true;
}

export function scoreAnswer(raw: string, answers: Answer[]): ScoreHit {
  const norm = normalize(raw);
  if (!norm) return miss();
  const entries = catalog(answers);
  for (const entry of entries) {
    if (entry.keys.includes(norm)) return hit(entry);
  }
  const typed = new Set(contentTokens(raw));
  const loose = entries.filter((entry) => entry.tokenSets.some((set) => covers(typed, set)));
  if (loose.length === 1) return hit(loose[0]);
  if (norm.length < 5) return miss();
  const close = entries.filter((entry) =>
    entry.keys.some((key) => key.length >= 5 && withinOneEdit(norm, key)),
  );
  if (close.length === 1) return hit(close[0]);
  return miss();
}
