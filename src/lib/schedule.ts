import { hashString, mulberry32 } from "./random";
import { PROMPT_COUNT } from "./tiers";
import type { Prompt, ScheduledDay } from "./types";

export type ScheduleResult = {
  days: ScheduledDay[];
  added: ScheduledDay[];
};

type DayPick = {
  ids: string[];
  mask: bigint;
  familyMask: bigint;
  key: string;
};

function popcount(value: bigint): number {
  let count = 0;
  let rest = value;
  while (rest) {
    rest &= rest - 1n;
    count += 1;
  }
  return count;
}

function playOrder(ids: string[], date: string): string[] {
  const copy = [...ids];
  const random = mulberry32(hashString(date));
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function enumerate(pool: Prompt[], familyBit: Map<string, number>): DayPick[] {
  const out: DayPick[] = [];
  const chosen: number[] = [];
  const families = new Set<string>();
  const patterns = new Set<string>();

  const walk = (start: number) => {
    if (chosen.length === PROMPT_COUNT) {
      const ids = chosen.map((index) => pool[index].id).sort();
      let mask = 0n;
      let familyMask = 0n;
      for (const index of chosen) {
        mask |= 1n << BigInt(index);
        familyMask |= 1n << BigInt(familyBit.get(pool[index].family) ?? 0);
      }
      out.push({ ids, mask, familyMask, key: ids.join("|") });
      return;
    }
    for (let index = start; index < pool.length; index += 1) {
      const prompt = pool[index];
      if (families.has(prompt.family) || patterns.has(prompt.pattern)) continue;
      if (pool.length - index < PROMPT_COUNT - chosen.length) break;
      families.add(prompt.family);
      patterns.add(prompt.pattern);
      chosen.push(index);
      walk(index + 1);
      chosen.pop();
      families.delete(prompt.family);
      patterns.delete(prompt.pattern);
    }
  };

  walk(0);
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

function pack(days: DayPick[], promptCount: number, prevMask: bigint): string[][] {
  const maxTarget = Math.floor(promptCount / PROMPT_COUNT);
  const failed = new Set<string>();

  const choices = (used: bigint, prev: bigint): DayPick[] => {
    const available: DayPick[] = [];
    const avoiding: DayPick[] = [];
    for (const day of days) {
      if (day.mask & used) continue;
      available.push(day);
      if ((day.familyMask & prev) === 0n) avoiding.push(day);
    }
    return avoiding.length > 0 ? avoiding : available;
  };

  const search = (used: bigint, prev: bigint, needed: number, path: DayPick[]): boolean => {
    if (needed === 0) return true;
    const key = `${used}:${prev}:${needed}`;
    if (failed.has(key)) return false;
    const full = (1n << BigInt(promptCount)) - 1n;
    const opts = choices(used, prev);
    if (opts.length === 0 || popcount(full ^ used) < needed * PROMPT_COUNT) {
      failed.add(key);
      return false;
    }

    const covered = new Map<number, number>();
    for (const day of opts) {
      let mask = day.mask;
      let bit = 0;
      while (mask) {
        if (mask & 1n) covered.set(bit, (covered.get(bit) ?? 0) + 1);
        mask >>= 1n;
        bit += 1;
      }
    }

    let rareBit = -1;
    let rareCount = Number.POSITIVE_INFINITY;
    for (let bit = 0; bit < promptCount; bit += 1) {
      if ((used >> BigInt(bit)) & 1n) continue;
      const count = covered.get(bit) ?? 0;
      if (count === 0 || count >= rareCount) continue;
      rareCount = count;
      rareBit = bit;
    }
    if (rareBit === -1) {
      failed.add(key);
      return false;
    }

    const rareMask = 1n << BigInt(rareBit);
    for (const day of opts) {
      if ((day.mask & rareMask) === 0n) continue;
      path.push(day);
      if (search(used | day.mask, day.familyMask, needed - 1, path)) return true;
      path.pop();
    }
    if (popcount(full ^ used ^ rareMask) >= needed * PROMPT_COUNT) {
      if (search(used | rareMask, prev, needed, path)) return true;
    }

    failed.add(key);
    return false;
  };

  for (let target = maxTarget; target >= 1; target -= 1) {
    const path: DayPick[] = [];
    if (search(0n, prevMask, target, path)) return path.map((day) => day.ids);
  }
  return [];
}

export function extendSchedule(
  prompts: Prompt[],
  existing: ScheduledDay[],
  startDate: string,
): ScheduleResult {
  const usedIds = new Set(existing.flatMap((day) => day.promptIds));
  const pool = prompts.filter((prompt) => !usedIds.has(prompt.id)).sort((a, b) => a.id.localeCompare(b.id));
  const families = [...new Set(prompts.map((prompt) => prompt.family))].sort();
  const familyBit = new Map(families.map((family, index) => [family, index]));
  const days = pool.length >= PROMPT_COUNT ? enumerate(pool, familyBit) : [];

  let prevMask = 0n;
  const last = existing.at(-1);
  if (last) {
    for (const id of last.promptIds) {
      const prompt = prompts.find((item) => item.id === id);
      const bit = prompt ? familyBit.get(prompt.family) : undefined;
      if (bit !== undefined) prevMask |= 1n << BigInt(bit);
    }
  }

  const packed = days.length ? pack(days, pool.length, prevMask) : [];
  let cursor = existing.length ? addIso(existing[existing.length - 1].date) : startDate;
  const added = packed.map((ids) => {
    const day = { date: cursor, promptIds: playOrder(ids, cursor) };
    cursor = addIso(cursor);
    return day;
  });
  const frozen = existing.map((day) => ({ date: day.date, promptIds: [...day.promptIds] }));
  return { days: [...frozen, ...added], added };
}

function addIso(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return utc.toISOString().slice(0, 10);
}
