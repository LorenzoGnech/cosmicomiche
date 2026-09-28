import { createHmac, timingSafeEqual } from "node:crypto";
import { emptyLocks } from "./playhead";
import { PROMPT_COUNT } from "./tiers";

export type StartPayload = {
  date: string;
  startedAt: number;
  promptIds: string[];
  lockedAt: (number | null)[];
};

function readLocks(value: unknown): (number | null)[] | null {
  if (value == null) return emptyLocks();
  if (!Array.isArray(value) || value.length !== PROMPT_COUNT) return null;
  const locks: (number | null)[] = [];
  for (const item of value) {
    if (item == null) locks.push(null);
    else if (typeof item === "number" && Number.isFinite(item)) locks.push(item);
    else return null;
  }
  return locks;
}

export function secret(): string {
  return process.env.COSMICOMICHE_SECRET || "dev-cosmicomiche-secret";
}

export function signPayload(payload: StartPayload, key = secret()): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyPayload(token: string, key = secret()): StartPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<StartPayload>;
    if (!parsed || typeof parsed.date !== "string" || typeof parsed.startedAt !== "number") return null;
    if (!Array.isArray(parsed.promptIds) || parsed.promptIds.some((id) => typeof id !== "string")) return null;
    const lockedAt = readLocks(parsed.lockedAt);
    if (!lockedAt) return null;
    return { date: parsed.date, startedAt: parsed.startedAt, promptIds: parsed.promptIds, lockedAt };
  } catch {
    return null;
  }
}
