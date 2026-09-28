import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadPromptEntries, loadPrompts, loadSchedule } from "../src/lib/bank";
import { extendSchedule } from "../src/lib/schedule";
import { validatePrompts } from "../src/lib/validate";
import type { Prompt } from "../src/lib/types";

function unique(ids: string[], prompts: Prompt[], key: "family" | "pattern"): number {
  return new Set(ids.map((id) => prompts.find((prompt) => prompt.id === id)?.[key])).size;
}

describe("content bank", () => {
  const entries = loadPromptEntries();
  const prompts = loadPrompts();
  const schedule = loadSchedule();

  it("is a valid archive of 20 prompts across enough families and patterns", () => {
    expect(validatePrompts(entries)).toEqual([]);
    expect(prompts).toHaveLength(20);
    expect(new Set(prompts.map((prompt) => prompt.family)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(prompts.map((prompt) => prompt.pattern)).size).toBeGreaterThanOrEqual(8);
  });

  it("schedules four playable Rome days without repeating a prompt", () => {
    expect(schedule.days).toEqual(extendSchedule(prompts, [], "2026-09-26").days);
    expect(schedule.days.map((day) => day.date)).toEqual([
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
    ]);
    const seen = new Set<string>();
    for (const day of schedule.days) {
      expect(day.promptIds).toHaveLength(5);
      expect(unique(day.promptIds, prompts, "family")).toBe(5);
      expect(unique(day.promptIds, prompts, "pattern")).toBe(5);
      for (const id of day.promptIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    const again = extendSchedule(prompts, schedule.days, "2026-09-26");
    expect(again.days.slice(0, schedule.days.length)).toEqual(schedule.days);
    expect(again.added).toEqual([]);
  });

  it("does not import the answer bank from the client", () => {
    const client = [
      readFileSync("src/scripts/game.ts", "utf8"),
      readFileSync("src/pages/index.astro", "utf8"),
      readFileSync("src/collage/collage.ts", "utf8"),
      readFileSync("src/collage/route.ts", "utf8"),
    ].join("\n");
    expect(client.includes("loadPrompts")).toBe(false);
    expect(client.includes("content/prompts")).toBe(false);
    expect(client.includes("Darmstadtio")).toBe(false);
  });
});
