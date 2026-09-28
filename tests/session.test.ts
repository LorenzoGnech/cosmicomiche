import { describe, expect, it } from "vitest";
import { buildDebrief, sessionError } from "../src/lib/debrief";
import { maxElapsedMs } from "../src/lib/tiers";
import { signPayload, verifyPayload } from "../src/lib/token";
import type { Prompt } from "../src/lib/types";

const prompt: Prompt = {
  id: "demo",
  family: "cibo",
  pattern: "elenco",
  text: "Un formaggio",
  answers: [
    { tier: "atmosfera", canonical: "Mozzarella" },
    { tier: "singolarita", canonical: "Strachitunt" },
  ],
};

describe("token", () => {
  it("round-trips and rejects a tampered body", () => {
    const token = signPayload(
      { date: "2026-09-26", startedAt: 10, promptIds: ["demo"], lockedAt: [null, null, null, null, null] },
      "test-secret",
    );
    expect(verifyPayload(token, "test-secret")?.startedAt).toBe(10);
    expect(verifyPayload(`${token}x`, "test-secret")).toBeNull();
    const [body, signature] = token.split(".");
    const flipped = `${body[0] === "A" ? "B" : "A"}${body.slice(1)}`;
    expect(verifyPayload(`${flipped}.${signature}`, "test-secret")).toBeNull();
  });
});

describe("session and debrief", () => {
  const payload = {
    date: "2026-09-26",
    startedAt: 1_000,
    promptIds: ["demo"],
    lockedAt: [null, null, null, null, null],
  };

  it("rejects a run past the grace window", () => {
    expect(sessionError(payload, 1_000 + maxElapsedMs() + 1, "2026-09-26", ["demo"])).toBe("Tempo scaduto");
    expect(sessionError(payload, 2_000, "2026-09-26", ["demo"])).toBeNull();
  });

  it("sums tiers and flags a singularity without listing the catalog", () => {
    const debrief = buildDebrief("2026-09-26", [prompt], ["strachitunt"]);
    expect(debrief.total).toBe(100);
    expect(debrief.singularity).toBe(true);
    expect(debrief.rows[0].canonical).toBe("Strachitunt");
    expect(JSON.stringify(debrief).includes("Mozzarella")).toBe(false);
  });
});
