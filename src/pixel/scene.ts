const W = 160;
const H = 144;

const PALETTE = {
  navy: "#0b1026",
  deep: "#141833",
  cream: "#f4e1c1",
  magenta: "#ff4fa3",
  acid: "#b6ff4a",
  white: "#fff6e8",
  dust: "#8d93b5",
};

export type SceneId = "flight" | "atmosfera" | "orbita" | "luna" | "vuoto" | "interstellare";

type Star = { x: number; y: number; color: string };

const stars: Star[] = Array.from({ length: 48 }, (_, index) => ({
  x: (index * 47) % W,
  y: (index * 29) % H,
  color: index % 11 === 0 ? PALETTE.acid : index % 5 === 0 ? PALETTE.magenta : PALETTE.cream,
}));

function fillCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const r2 = radius * radius;
  for (let y = -radius; y <= radius; y += 1) {
    const span = Math.floor(Math.sqrt(r2 - y * y));
    ctx.fillRect(cx - span, cy + y, span * 2 + 1, 1);
  }
}

function blit(ctx: CanvasRenderingContext2D, x: number, y: number, rows: string[]): void {
  rows.forEach((row, dy) => {
    [...row].forEach((pixel, dx) => {
      if (pixel === ".") return;
      ctx.fillStyle = pixel === "#" ? PALETTE.cream : pixel === "M" ? PALETTE.magenta : PALETTE.acid;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    });
  });
}

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  blit(ctx, x, y, ["....##....", "...#MM#...", "..#MMMM#..", ".#M#MM#M#.", "##MMMMMM##", ".########.", "..#....#..", ".##....##."]);
}

function drawStars(ctx: CanvasRenderingContext2D, drift: number, density: number): void {
  for (const star of stars.slice(0, density)) {
    const y = (star.y + drift) % H;
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, y, star.x % 7 === 0 ? 2 : 1, 1);
  }
}

function drawEarth(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  fillCircle(ctx, cx, cy, radius, PALETTE.deep);
  fillCircle(ctx, cx - 6, cy - 4, Math.max(4, radius - 10), PALETTE.acid);
  ctx.fillStyle = PALETTE.magenta;
  ctx.fillRect(cx - 2, cy + 2, 6, 4);
  ctx.fillRect(cx + 8, cy - 2, 4, 3);
}

function drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  fillCircle(ctx, cx, cy, radius, PALETTE.cream);
  ctx.fillStyle = PALETTE.dust;
  ctx.fillRect(cx - 8, cy - 4, 4, 3);
  ctx.fillRect(cx + 6, cy + 5, 5, 4);
  ctx.fillRect(cx - 2, cy + 10, 3, 3);
}

function drawRinged(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = PALETTE.magenta;
  ctx.fillRect(cx - 28, cy - 1, 56, 3);
  fillCircle(ctx, cx, cy, 14, PALETTE.cream);
  ctx.fillStyle = PALETTE.magenta;
  ctx.fillRect(cx - 10, cy - 1, 20, 2);
}

function drawNebula(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.magenta;
  ctx.fillRect(18, 40, 28, 8);
  ctx.fillRect(30, 48, 40, 6);
  ctx.fillStyle = PALETTE.acid;
  ctx.fillRect(70, 70, 36, 6);
  ctx.fillRect(84, 76, 22, 5);
  ctx.fillStyle = PALETTE.deep;
  ctx.fillRect(40, 90, 50, 4);
}

function drawSingularity(ctx: CanvasRenderingContext2D, timeMs: number, reduced: boolean): void {
  const pulse = reduced ? 0 : Math.floor(timeMs / 200) % 2;
  fillCircle(ctx, 80, 72, 8, PALETTE.navy);
  const color = pulse ? PALETTE.acid : PALETTE.magenta;
  for (let y = -16; y <= 16; y += 1) {
    for (let x = -16; x <= 16; x += 1) {
      const distance = Math.hypot(x, y);
      if (distance >= 13 && distance <= 16) {
        ctx.fillStyle = color;
        ctx.fillRect(80 + x, 72 + y, 1, 1);
      }
    }
  }
  ctx.fillStyle = PALETTE.white;
  ctx.fillRect(79, 71, 2, 2);
}

function lerp(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}

export function drawTransit(
  ctx: CanvasRenderingContext2D,
  scene: Exclude<SceneId, "flight">,
  progress: number,
  timeMs: number,
  singularity: boolean,
  reduced: boolean,
): void {
  const t = reduced ? 1 : Math.min(1, Math.max(0, progress));
  const pace = scene === "atmosfera" ? 110 : scene === "orbita" ? 70 : scene === "luna" ? 46 : 28;
  const drift = reduced ? 0 : Math.floor(timeMs / pace) + Math.floor(t * 24);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PALETTE.navy;
  ctx.fillRect(0, 0, W, H);
  drawStars(ctx, drift, scene === "vuoto" || scene === "interstellare" ? 48 : 28);

  if (scene === "atmosfera") {
    drawEarth(ctx, 80, lerp(148, 156, t), lerp(54, 58, t));
    drawShip(ctx, 74, lerp(78, 58, t));
  } else if (scene === "orbita") {
    drawEarth(ctx, lerp(80, 36, t), lerp(140, 112, t), lerp(48, 22, t));
    drawShip(ctx, lerp(74, 78, t), lerp(86, 28, t));
  } else if (scene === "luna") {
    drawEarth(ctx, lerp(70, 22, t), lerp(130, 28, t), lerp(36, 8, t));
    drawMoon(ctx, lerp(130, 96, t), lerp(110, 78, t), lerp(10, 34, t));
    drawShip(ctx, lerp(48, 58, t), lerp(100, 88, t));
  } else if (scene === "vuoto") {
    if (t < 0.45) drawEarth(ctx, 80, lerp(130, 160, t / 0.45), lerp(28, 8, t / 0.45));
    drawRinged(ctx, 80, 78);
    drawShip(ctx, lerp(70, 18, t), lerp(100, 24, t));
  } else {
    drawNebula(ctx);
    drawShip(ctx, 72, lerp(108, 20, t));
  }

  if (singularity) drawSingularity(ctx, timeMs, reduced);
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneId,
  timeMs: number,
  singularity: boolean,
  reduced: boolean,
): void {
  ctx.imageSmoothingEnabled = false;
  const drift = reduced ? 0 : Math.floor(timeMs / (scene === "flight" ? 70 : 140));
  ctx.fillStyle = PALETTE.navy;
  ctx.fillRect(0, 0, W, H);
  drawStars(ctx, drift, scene === "interstellare" ? 48 : 28);

  if (scene === "flight" || scene === "atmosfera") {
    drawEarth(ctx, 80, scene === "flight" ? 150 : 132, scene === "flight" ? 54 : 62);
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(30, 78, 10, 3);
    ctx.fillRect(100, 70, 14, 3);
    const bob = reduced ? 0 : Math.floor(timeMs / 300) % 2;
    drawShip(ctx, 74, (scene === "flight" ? 48 : 36) + bob);
  } else if (scene === "orbita") {
    drawEarth(ctx, 36, 108, 26);
    ctx.fillStyle = PALETTE.dust;
    ctx.fillRect(108, 40, 8, 3);
    ctx.fillRect(116, 41, 6, 1);
    drawShip(ctx, 78, 28);
  } else if (scene === "luna") {
    drawMoon(ctx, 96, 78, 34);
    drawEarth(ctx, 22, 24, 8);
    drawShip(ctx, 40, 96);
  } else if (scene === "vuoto") {
    drawRinged(ctx, 80, 78);
    drawShip(ctx, 18, 24);
  } else {
    drawNebula(ctx);
    drawShip(ctx, 72, 24);
  }

  if (singularity) drawSingularity(ctx, timeMs, reduced);
}
