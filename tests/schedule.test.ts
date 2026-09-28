import { describe, expect, it } from "vitest";
import { extendSchedule } from "../src/lib/schedule";
import type { Family, Pattern, Prompt } from "../src/lib/types";

const patterns: Pattern[] = ["opere-di", "elenco", "luogo", "persona", "tempo"];
const alpha: Family[] = ["musica", "cibo", "geografia", "sport", "storia"];
const beta: Family[] = ["cinema", "scienza", "lingua", "oggetti", "natura"];

function mini(id: string, family: Family, pattern: Pattern): Prompt {
  return { id, family, pattern, text: id, answers: [] };
}

function families(ids: string[], prompts: Prompt[]): Set<string> {
  return new Set(ids.map((id) => prompts.find((prompt) => prompt.id === id)?.family));
}

function patternsOf(ids: string[], prompts: Prompt[]): Set<string> {
  return new Set(ids.map((id) => prompts.find((prompt) => prompt.id === id)?.pattern));
}

describe("extendSchedule", () => {
  const paired = [
    ...alpha.map((family, index) => mini(`a-${family}`, family, patterns[index])),
    ...beta.map((family, index) => mini(`b-${family}`, family, patterns[index])),
  ];

  it("keeps families and patterns unique in a day and avoids yesterday when it can", () => {
    const result = extendSchedule(paired, [], "2026-09-26");
    expect(result.days).toHaveLength(2);
    for (const day of result.days) {
      expect(families(day.promptIds, paired).size).toBe(5);
      expect(patternsOf(day.promptIds, paired).size).toBe(5);
    }
    const first = families(result.days[0].promptIds, paired);
    for (const family of families(result.days[1].promptIds, paired)) {
      expect(first.has(family)).toBe(false);
    }
  });

  it("still fills a day when every family was used yesterday", () => {
    const repeated = [1, 2].flatMap((copy) =>
      alpha.map((family, index) => mini(`${family}-${copy}`, family, patterns[index])),
    );
    const result = extendSchedule(repeated, [], "2026-09-26");
    expect(result.days).toHaveLength(2);
    expect(families(result.days[1].promptIds, repeated).size).toBe(5);
  });

  it("appends without rewriting or reusing prompts", () => {
    const firstPool = alpha.map((family, index) => mini(`a-${family}`, family, patterns[index]));
    const first = extendSchedule(firstPool, [], "2026-09-26");
    const second = extendSchedule(paired, first.days, "2026-09-26");
    expect(second.days[0]).toEqual(first.days[0]);
    expect(second.days).toHaveLength(2);
    const used = new Set(second.days[0].promptIds);
    for (const id of second.days[1].promptIds) expect(used.has(id)).toBe(false);
  });
});
