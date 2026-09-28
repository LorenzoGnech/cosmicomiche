import { describe, expect, it } from "vitest";
import { normalize, withinOneEdit } from "../src/lib/normalize";
import { scoreAnswer } from "../src/lib/score";
import type { Answer } from "../src/lib/types";

const sample: Answer[] = [
  { tier: "atmosfera", canonical: "Caffè", aliases: ["cafe"] },
  { tier: "orbita", canonical: "Emozioni" },
  { tier: "luna", canonical: "Emozione" },
  { tier: "singolarita", canonical: "Zuzzurellone" },
];

describe("normalize", () => {
  it("folds case, accents, apostrophes and punctuation", () => {
    expect(normalize("  Un'Avventura... ")).toBe("unavventura");
    expect(normalize("Caffè")).toBe("caffe");
    expect(normalize("Sì, viaggiare")).toBe("si viaggiare");
    expect(normalize("Creuza de mä")).toBe("creuza de ma");
  });
});

describe("withinOneEdit", () => {
  it("accepts one insertion, deletion or substitution", () => {
    expect(withinOneEdit("emozioni", "emozion")).toBe(true);
    expect(withinOneEdit("emozioni", "emozioni")).toBe(true);
    expect(withinOneEdit("emozioni", "emoziono")).toBe(true);
    expect(withinOneEdit("emozioni", "zzzzzzz")).toBe(false);
  });
});

describe("scoreAnswer", () => {
  it("matches canonical text, aliases and a single typo", () => {
    expect(scoreAnswer("CAFFÈ", sample).points).toBe(10);
    expect(scoreAnswer("cafe", sample).tier).toBe("atmosfera");
    expect(scoreAnswer("Emozionii", sample).canonical).toBe("Emozioni");
  });

  it("accepts a name alone, with d', or with the full phrase", () => {
    const lakes: Answer[] = [
      { tier: "atmosfera", canonical: "Lago di Garda", aliases: ["garda"] },
      { tier: "orbita", canonical: "Lago d'Iseo", aliases: ["iseo", "lago di iseo"] },
    ];
    for (const typed of ["Iseo", "D'iseo", "d’Iseo", "lago d'iseo", "lago di iseo", "Di Iseo"]) {
      expect(scoreAnswer(typed, lakes).canonical).toBe("Lago d'Iseo");
    }
    expect(scoreAnswer("lago", lakes).points).toBe(0);
    expect(scoreAnswer("garda", lakes).canonical).toBe("Lago di Garda");
  });

  it("rejects blanks, short typos and ambiguous typos", () => {
    expect(scoreAnswer("   ", sample).points).toBe(0);
    expect(scoreAnswer("oro", [{ tier: "atmosfera", canonical: "Oro" }]).points).toBe(10);
    expect(scoreAnswer("ora", [{ tier: "atmosfera", canonical: "Oro" }]).points).toBe(0);
    expect(scoreAnswer("emozionx", sample).points).toBe(0);
    expect(scoreAnswer("niente-a-che-vedere", sample).label).toBe("Fuori rotta");
  });
});
