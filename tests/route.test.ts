import { describe, expect, it } from "vitest";
import { positionFor, reachedFor, WAYPOINTS } from "../src/collage/route";
import { MAX_SCORE } from "../src/lib/tiers";

describe("route", () => {
  it("starts at Earth, ends past Pluto, and only moves forward", () => {
    expect(WAYPOINTS[0]!.at).toBe(0);
    expect(WAYPOINTS[WAYPOINTS.length - 1]!.at).toBe(MAX_SCORE);
    let previous = -Infinity;
    for (let total = 0; total <= MAX_SCORE; total += 5) {
      const { x } = positionFor(total);
      expect(x).toBeGreaterThanOrEqual(previous);
      previous = x;
    }
  });

  it("puts the ship on a body's anchor when the total reaches it", () => {
    const mars = WAYPOINTS.find((waypoint) => waypoint.id === "marte")!;
    expect(positionFor(mars.at)).toEqual(mars.ship);
    expect(reachedFor(mars.at - 1).id).toBe("luna");
    expect(reachedFor(mars.at).id).toBe("marte");
    expect(positionFor(-20)).toEqual(WAYPOINTS[0]!.ship);
    expect(positionFor(9_999)).toEqual(WAYPOINTS[WAYPOINTS.length - 1]!.ship);
  });
});
