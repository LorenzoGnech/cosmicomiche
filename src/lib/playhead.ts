import { PROMPT_COUNT, PROMPT_MS, TRANSIT_MS } from "./tiers";

export type PlayPhase =
  | { phase: "prompt"; index: number; remainingMs: number }
  | { phase: "gap"; index: number; remainingMs: number }
  | { phase: "over" };

export type Slot = { open: number; close: number; next: number };

export function emptyLocks(): (number | null)[] {
  return Array.from({ length: PROMPT_COUNT }, () => null);
}

export function slotBounds(startedAt: number, lockedAt: (number | null)[] = emptyLocks()): Slot[] {
  const slots: Slot[] = [];
  let open = startedAt;
  for (let index = 0; index < PROMPT_COUNT; index += 1) {
    const cap = open + PROMPT_MS;
    const mark = lockedAt[index];
    const close = mark != null && mark > open && mark < cap ? mark : cap;
    const next = close + TRANSIT_MS;
    slots.push({ open, close, next });
    open = next;
  }
  return slots;
}

export function playhead(startedAt: number, now: number, lockedAt: (number | null)[] = emptyLocks()): PlayPhase {
  const slots = slotBounds(startedAt, lockedAt);
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (now < slot.close) return { phase: "prompt", index, remainingMs: slot.close - now };
    if (now < slot.next) return { phase: "gap", index, remainingMs: slot.next - now };
  }
  return { phase: "over" };
}

export function applyClock(
  committed: (string | null)[],
  draft: string,
  draftIndex: number,
  startedAt: number,
  now: number,
  lockedAt: (number | null)[] = emptyLocks(),
): { committed: (string | null)[]; phase: PlayPhase } {
  const phase = playhead(startedAt, now, lockedAt);
  const next = committed.slice();
  const closedUntil =
    phase.phase === "over" ? PROMPT_COUNT : phase.phase === "gap" ? phase.index + 1 : phase.index;
  for (let i = 0; i < closedUntil; i += 1) {
    if (next[i] == null) next[i] = i === draftIndex ? draft : "";
  }
  return { committed: next, phase };
}
