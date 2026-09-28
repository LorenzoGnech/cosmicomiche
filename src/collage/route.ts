import { MAX_SCORE } from "../lib/tiers";

export type Cutout =
  | { kind: "disc"; src: string; rx: number; ry: number }
  | { kind: "clipping"; src: string; aspect: number }
  | { kind: "belt" }
  | { kind: "headline"; text: string };

export type Waypoint = {
  id: string;
  label: string;
  /** Running total at which the ship reaches this body. */
  at: number;
  /** Body centre on the track: x in px, y as a fraction of the sky height. */
  x: number;
  y: number;
  size: number;
  tilt: number;
  cutout: Cutout;
  /** Where the ship sits when its total equals `at`. */
  ship: { x: number; y: number };
};

export const WAYPOINTS: Waypoint[] = [
  {
    id: "terra", label: "Terra", at: 0, x: 200, y: 0.48, size: 240, tilt: -4,
    cutout: { kind: "disc", src: "/cutouts/earth.jpg", rx: 45, ry: 45 },
    ship: { x: 280, y: 0.16 },
  },
  {
    id: "luna", label: "Luna", at: 30, x: 620, y: 0.3, size: 120, tilt: 6,
    cutout: { kind: "disc", src: "/cutouts/moon.jpg", rx: 42, ry: 44 },
    ship: { x: 640, y: 0.62 },
  },
  {
    id: "marte", label: "Marte", at: 80, x: 1120, y: 0.46, size: 170, tilt: -7,
    cutout: { kind: "disc", src: "/cutouts/mars.jpg", rx: 42, ry: 42 },
    ship: { x: 1140, y: 0.14 },
  },
  {
    id: "asteroidi", label: "Fascia degli asteroidi", at: 130, x: 1640, y: 0.5, size: 300, tilt: 0,
    cutout: { kind: "belt" },
    ship: { x: 1640, y: 0.4 },
  },
  {
    id: "giove", label: "Giove", at: 190, x: 2240, y: 0.44, size: 300, tilt: 3,
    cutout: { kind: "disc", src: "/cutouts/jupiter.jpg", rx: 45, ry: 45 },
    ship: { x: 2260, y: 0.08 },
  },
  {
    id: "saturno", label: "Saturno", at: 260, x: 2900, y: 0.42, size: 360, tilt: -5,
    cutout: { kind: "clipping", src: "/cutouts/saturn.jpg", aspect: 500 / 242 },
    ship: { x: 2900, y: 0.8 },
  },
  {
    id: "urano", label: "Urano", at: 330, x: 3500, y: 0.36, size: 170, tilt: 8,
    cutout: { kind: "disc", src: "/cutouts/uranus.jpg", rx: 41, ry: 41 },
    ship: { x: 3520, y: 0.72 },
  },
  {
    id: "nettuno", label: "Nettuno", at: 400, x: 4060, y: 0.5, size: 180, tilt: -3,
    cutout: { kind: "disc", src: "/cutouts/neptune.jpg", rx: 43, ry: 43 },
    ship: { x: 4080, y: 0.14 },
  },
  {
    id: "plutone", label: "Plutone", at: 460, x: 4560, y: 0.34, size: 90, tilt: 10,
    cutout: { kind: "disc", src: "/cutouts/pluto.jpg", rx: 43, ry: 43 },
    ship: { x: 4580, y: 0.64 },
  },
  {
    id: "oltre", label: "Oltre", at: MAX_SCORE, x: 5100, y: 0.4, size: 260, tilt: -6,
    cutout: { kind: "headline", text: "Oltre!" },
    ship: { x: 5120, y: 0.72 },
  },
];

export const TRACK_WIDTH = 5500;

export type ShipPoint = { x: number; y: number };

/** Ship position on the track for a running total, interpolated between waypoints. */
export function positionFor(total: number): ShipPoint {
  const clamped = Math.max(0, Math.min(MAX_SCORE, total));
  for (let i = 1; i < WAYPOINTS.length; i += 1) {
    const prev = WAYPOINTS[i - 1]!;
    const next = WAYPOINTS[i]!;
    if (clamped <= next.at) {
      const t = next.at === prev.at ? 1 : (clamped - prev.at) / (next.at - prev.at);
      return {
        x: prev.ship.x + (next.ship.x - prev.ship.x) * t,
        y: prev.ship.y + (next.ship.y - prev.ship.y) * t,
      };
    }
  }
  const last = WAYPOINTS[WAYPOINTS.length - 1]!;
  return { ...last.ship };
}

/** The farthest body the total has reached. */
export function reachedFor(total: number): Waypoint {
  let reached = WAYPOINTS[0]!;
  for (const waypoint of WAYPOINTS) if (total >= waypoint.at) reached = waypoint;
  return reached;
}
