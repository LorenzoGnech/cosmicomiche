import type { BandId } from "./tiers";
import type { TierId } from "./types";

export function matchingPeek(peek: Peek | null, answer: string): Peek | null {
  if (!peek || peek.answer !== answer.trim()) return null;
  return peek;
}

export type PromptCard = {
  id: string;
  text: string;
};

export type Peek = {
  answer: string;
  tier: TierId | null;
  label: string;
  points: number;
  canonical: string | null;
};

export type LockResult = {
  token: string;
  lockedAt: (number | null)[];
  peek: Peek;
};

export type DebriefRow = {
  id: string;
  text: string;
  answer: string;
  tier: TierId | null;
  label: string;
  points: number;
  canonical: string | null;
};

export type Debrief = {
  date: string;
  total: number;
  max: number;
  band: BandId;
  bandLabel: string;
  singularity: boolean;
  rows: DebriefRow[];
};

export type DiveState =
  | { status: "empty"; date: string }
  | { status: "ready"; date: string }
  | {
      status: "playing";
      date: string;
      startedAt: number;
      prompts: PromptCard[];
      token: string;
      lockedAt: (number | null)[];
    }
  | { status: "done"; debrief: Debrief };

export const START_COOKIE = "cosmicomiche-start";
export const RESULT_COOKIE = "cosmicomiche-result";
