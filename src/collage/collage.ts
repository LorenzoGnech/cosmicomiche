import { mulberry32 } from "../lib/random";
import { positionFor, TRACK_WIDTH, WAYPOINTS, type ShipPoint, type Waypoint } from "./route";

/** Design height of the sky strip; the whole track scales from it. */
const SKY_HEIGHT = 520;
const FPS = 10;
const SHIP_WIDTH = 150;

type Piece = { el: HTMLElement; tilt: number; wobble: number };

type Flight =
  | { kind: "rest"; total: number }
  | { kind: "fly"; from: number; to: number; progress: number };

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pieces: Piece[] = [];
let sky: HTMLElement | null = null;
let track: HTMLElement | null = null;
let ship: HTMLElement | null = null;
let burst: HTMLElement | null = null;
let flight: Flight = { kind: "rest", total: 0 };
let singularity = false;
let frameCount = 0;
let jitter = mulberry32(7);

function jaggedPolygon(seed: number, rx: number, ry: number, points: number, rough: number): string {
  const rand = mulberry32(seed);
  const coords: string[] = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 1 + (rand() - 0.5) * rough;
    const x = 50 + Math.cos(angle) * rx * wobble;
    const y = 50 + Math.sin(angle) * ry * wobble;
    coords.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${coords.join(",")})`;
}

function tornRect(seed: number, inset: number, teeth: number): string {
  const rand = mulberry32(seed);
  const coords: string[] = [];
  const edge = (from: [number, number], to: [number, number]) => {
    for (let i = 0; i < teeth; i += 1) {
      const t = i / teeth;
      const x = from[0] + (to[0] - from[0]) * t + (rand() - 0.5) * inset;
      const y = from[1] + (to[1] - from[1]) * t + (rand() - 0.5) * inset;
      coords.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
    }
  };
  edge([inset, inset], [100 - inset, inset]);
  edge([100 - inset, inset], [100 - inset, 100 - inset]);
  edge([100 - inset, 100 - inset], [inset, 100 - inset]);
  edge([inset, 100 - inset], [inset, inset]);
  return `polygon(${coords.join(",")})`;
}

function starPolygon(points: number, inner: number): string {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 50 : 50 * inner;
    coords.push(`${(50 + Math.cos(angle) * r).toFixed(2)}% ${(50 + Math.sin(angle) * r).toFixed(2)}%`);
  }
  return `polygon(${coords.join(",")})`;
}

function el(tag: string, className: string, parent: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

function place(node: HTMLElement, x: number, y: number, w: number, h: number): void {
  node.style.left = `${x - w / 2}px`;
  node.style.top = `${y - h / 2}px`;
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
}

function addPiece(node: HTMLElement, tilt: number, wobble = 1): void {
  node.style.rotate = `${tilt}deg`;
  pieces.push({ el: node, tilt, wobble });
}

function buildBody(parent: HTMLElement, waypoint: Waypoint, seed: number): void {
  const cx = waypoint.x;
  const cy = waypoint.y * SKY_HEIGHT;
  const cutout = waypoint.cutout;

  if (cutout.kind === "disc") {
    const wrap = el("div", "cutout", parent);
    place(wrap, cx, cy, waypoint.size, waypoint.size);
    const paper = el("div", "cutout-paper", wrap);
    paper.style.clipPath = jaggedPolygon(seed, cutout.rx + 3.5, cutout.ry + 3.5, 34, 0.06);
    const img = el("img", "cutout-img", wrap) as HTMLImageElement;
    img.src = cutout.src;
    img.alt = "";
    img.style.clipPath = jaggedPolygon(seed + 1, cutout.rx, cutout.ry, 34, 0.035);
    addPiece(wrap, waypoint.tilt);
  } else if (cutout.kind === "clipping") {
    const h = waypoint.size / cutout.aspect;
    const wrap = el("div", "cutout", parent);
    place(wrap, cx, cy, waypoint.size, h);
    const paper = el("div", "cutout-paper", wrap);
    paper.style.clipPath = tornRect(seed, 1.5, 9);
    const img = el("img", "cutout-img", wrap) as HTMLImageElement;
    img.src = cutout.src;
    img.alt = "";
    img.style.clipPath = tornRect(seed + 1, 5, 9);
    el("span", "tape", wrap);
    addPiece(wrap, waypoint.tilt);
  } else if (cutout.kind === "belt") {
    const rand = mulberry32(seed);
    for (let i = 0; i < 14; i += 1) {
      const size = 16 + rand() * 34;
      const rock = el("div", "cutout rock", parent);
      const x = cx - waypoint.size / 2 + rand() * waypoint.size;
      const y = cy + (rand() - 0.5) * 150 + Math.sin(i) * 20;
      place(rock, x, y, size, size * (0.7 + rand() * 0.4));
      const paper = el("div", "cutout-paper", rock);
      paper.style.clipPath = jaggedPolygon(seed + i * 3, 48, 48, 9, 0.5);
      const stone = el("div", "rock-face", rock);
      stone.style.clipPath = jaggedPolygon(seed + i * 3, 40, 40, 9, 0.5);
      addPiece(rock, rand() * 360, 2);
    }
  } else {
    const wrap = el("div", "cutout headline", parent);
    place(wrap, cx, cy, waypoint.size, waypoint.size * 0.42);
    wrap.style.clipPath = tornRect(seed, 2, 7);
    wrap.textContent = cutout.text;
    addPiece(wrap, waypoint.tilt);
    return;
  }

  const label = el("span", "label", parent);
  label.textContent = waypoint.label;
  const labelY = cutout.kind === "belt" ? cy + 110 : cy + (cutout.kind === "clipping" ? waypoint.size / 2 / cutout.aspect : waypoint.size / 2) + 18;
  label.style.left = `${cx}px`;
  label.style.top = `${Math.min(labelY, SKY_HEIGHT - 60)}px`;
  addPiece(label, (seed % 7) - 3, 0.6);
}

function buildStars(parent: HTMLElement): void {
  const rand = mulberry32(2026);
  const shape = starPolygon(5, 0.45);
  for (let i = 0; i < 70; i += 1) {
    const size = 8 + rand() * 20;
    const star = el("div", `star${rand() < 0.3 ? " star-mustard" : ""}`, parent);
    place(star, rand() * TRACK_WIDTH, 12 + rand() * (SKY_HEIGHT - 40), size, size);
    star.style.clipPath = shape;
    addPiece(star, rand() * 72, 3);
  }
}

export function mountCollage(root: HTMLElement): void {
  root.innerHTML = "";
  sky = el("div", "sky", root);
  track = el("div", "track", sky);
  track.style.width = `${TRACK_WIDTH}px`;
  track.style.height = `${SKY_HEIGHT}px`;
  buildStars(track);
  WAYPOINTS.forEach((waypoint, index) => buildBody(track!, waypoint, 101 + index * 17));

  burst = el("div", "burst", track);
  burst.style.clipPath = starPolygon(14, 0.62);
  burst.textContent = "!";
  burst.hidden = true;

  ship = el("div", "ship", track);
  const img = el("img", "ship-img", ship) as HTMLImageElement;
  img.src = "/cutouts/rocket.svg";
  img.alt = "";
  ship.style.width = `${SHIP_WIDTH}px`;
  ship.style.height = `${SHIP_WIDTH / 2}px`;

  window.addEventListener("resize", render);
  render();
  if (!reduced) window.setInterval(render, 1000 / FPS);
}

export function placeShip(total: number): void {
  flight = { kind: "rest", total };
  if (reduced) render();
}

export function flyShip(from: number, to: number, progress: number): void {
  flight = { kind: "fly", from, to, progress: Math.max(0, Math.min(1, progress)) };
  if (reduced) render();
}

export function markSingularity(on: boolean): void {
  singularity = on;
  if (reduced) render();
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function shipState(): { point: ShipPoint; heading: number; moving: boolean } {
  if (flight.kind === "rest" || reduced) {
    const total = flight.kind === "rest" ? flight.total : flight.to;
    return { point: positionFor(total), heading: 0, moving: false };
  }
  const from = positionFor(flight.from);
  const to = positionFor(flight.to);
  const t = ease(flight.progress);
  const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  const dx = to.x - from.x;
  const dy = (to.y - from.y) * SKY_HEIGHT;
  const heading = Math.abs(dx) + Math.abs(dy) < 1 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  return { point, heading: Math.max(-35, Math.min(35, heading)), moving: flight.progress < 1 };
}

function render(): void {
  if (!sky || !track || !ship || !burst) return;
  frameCount += 1;
  jitter = mulberry32(frameCount * 7919);
  const scale = sky.clientHeight / SKY_HEIGHT;
  const viewWidth = sky.clientWidth / scale;

  const { point, heading, moving } = shipState();
  const shipX = point.x;
  const shipY = point.y * SKY_HEIGHT;
  const camera = Math.max(0, Math.min(TRACK_WIDTH - viewWidth, shipX - viewWidth * 0.42));
  track.style.transform = `scale(${scale}) translateX(${-Math.round(camera)}px)`;

  const shake = reduced ? 0 : moving ? 2.5 : 1;
  for (const piece of pieces) {
    const amount = reduced ? 0 : piece.wobble;
    const r = piece.tilt + (jitter() - 0.5) * 3 * amount;
    const dx = (jitter() - 0.5) * 2 * amount;
    const dy = (jitter() - 0.5) * 2 * amount;
    piece.el.style.rotate = `${r.toFixed(2)}deg`;
    piece.el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
  }

  const bob = reduced ? 0 : Math.sin(frameCount / 3) * 3;
  place(ship, Math.round(shipX), Math.round(shipY + bob), SHIP_WIDTH, SHIP_WIDTH / 2);
  const shipTilt = heading + (jitter() - 0.5) * 4 * shake;
  ship.style.rotate = `${shipTilt.toFixed(2)}deg`;
  ship.classList.toggle("moving", moving);

  burst.hidden = !singularity;
  if (singularity) {
    place(burst, Math.round(shipX + 70), Math.round(shipY - 46), 64, 64);
    burst.style.rotate = `${((frameCount * 9) % 360).toFixed(0)}deg`;
  }
}
