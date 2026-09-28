import { describe, expect, it } from "vitest";
import { matchingPeek, type Peek } from "../src/lib/api-types";
import { applyClock, playhead } from "../src/lib/playhead";
import { PROMPT_MS, TRANSIT_MS } from "../src/lib/tiers";

describe("playhead", () => {
  it("walks prompts, the transit, and the end of the run", () => {
    expect(playhead(0, 0)).toEqual({ phase: "prompt", index: 0, remainingMs: PROMPT_MS });
    expect(playhead(0, PROMPT_MS)).toMatchObject({ phase: "gap", index: 0, remainingMs: TRANSIT_MS });
    expect(playhead(0, PROMPT_MS + TRANSIT_MS)).toMatchObject({ phase: "prompt", index: 1 });
    expect(playhead(0, 5 * (PROMPT_MS + TRANSIT_MS)).phase).toBe("over");
  });

  it("ends a locked prompt and opens the next one after the transit", () => {
    const locked = [10_000, null, null, null, null];
    expect(playhead(0, 10_000, locked)).toMatchObject({ phase: "gap", index: 0, remainingMs: TRANSIT_MS });
    expect(playhead(0, 9_000, locked)).toMatchObject({ phase: "prompt", index: 0 });
    expect(playhead(0, 10_000 + TRANSIT_MS, locked)).toMatchObject({ phase: "prompt", index: 1, remainingMs: PROMPT_MS });
  });
});

describe("matchingPeek", () => {
  const peek: Peek = { answer: "Roma", tier: "atmosfera", label: "Atmosfera", points: 10, canonical: "Roma" };

  it("stays on the text that was checked and drops when that text changes", () => {
    expect(matchingPeek(peek, " Roma ")?.points).toBe(10);
    expect(matchingPeek(peek, "Enna")).toBeNull();
    expect(matchingPeek(null, "Roma")).toBeNull();
  });
});

describe("applyClock", () => {
  it("commits the open draft when the slot closes and blanks the prompts that were missed", () => {
    const open = applyClock([null, null, null, null, null], "Roma", 0, 0, 1_000);
    expect(open.committed[0]).toBeNull();
    const closed = applyClock([null, null, null, null, null], "Roma", 0, 0, PROMPT_MS + 10);
    expect(closed.committed[0]).toBe("Roma");
    const skipped = applyClock([null, null, null, null, null], "Roma", 0, 0, 2 * (PROMPT_MS + TRANSIT_MS) + 10);
    expect(skipped.committed[0]).toBe("Roma");
    expect(skipped.committed[1]).toBe("");
  });
});
