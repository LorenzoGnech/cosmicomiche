import { matchingPeek, type Debrief, type DiveState, type LockResult, type Peek, type PromptCard } from "../lib/api-types";
import { normalize } from "../lib/normalize";
import { applyClock, emptyLocks, playhead, type PlayPhase } from "../lib/playhead";
import { formatDayLabel } from "../lib/rome";
import { PROMPT_COUNT, PROMPT_MS, TRANSIT_MS } from "../lib/tiers";
import type { TierId } from "../lib/types";
import { drawScene, drawTransit, type SceneId } from "../pixel/scene";

const STORAGE = "cosmicomiche-progress";

type Stored = {
  token: string;
  committed: (string | null)[];
  draft: string;
  draftIndex: number;
  peeks: (Peek | null)[];
  chosen: (string | null)[];
};

type Mode = "loading" | "empty" | "ready" | "play" | "done" | "error";

const app = document.querySelector<HTMLElement>("#app");
const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const ctx = canvas?.getContext("2d") ?? null;
if (!app || !canvas || !ctx) throw new Error("Manca la pagina");

const drawing = ctx;
let mode: Mode = "loading";
let date = "";
let token = "";
let startedAt = 0;
let lockedAt: (number | null)[] = emptyLocks();
let prompts: PromptCard[] = [];
let transit: { scene: Exclude<SceneId, "flight">; progress: number; singularity: boolean } | null = null;
let transitPeekIndex = -1;
let committed: (string | null)[] = emptyCommitted();
let peeks: (Peek | null)[] = emptyPeeks();
let draftIndex = -1;
let pendingDraft = "";
let peeking = false;
let chosen: (string | null)[] = emptyCommitted();
let debrief: Debrief | null = null;
let errorMessage = "";
let viewKey = "";
let submitting = false;
let loop = 0;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function emptyCommitted(): (string | null)[] {
  return Array.from({ length: PROMPT_COUNT }, () => null);
}

function emptyPeeks(): (Peek | null)[] {
  return Array.from({ length: PROMPT_COUNT }, () => null);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readStore(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || parsed.token !== token || !Array.isArray(parsed.committed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function save(): void {
  if (mode !== "play") return;
  const payload: Stored = { token, committed, draft: pendingDraft, draftIndex, peeks, chosen };
  try {
    localStorage.setItem(STORAGE, JSON.stringify(payload));
  } catch {
    // The run still lives in memory if storage is blocked.
  }
}

function flightForTier(tier: TierId | null): { scene: Exclude<SceneId, "flight">; singularity: boolean } {
  if (tier === "singolarita") return { scene: "interstellare", singularity: true };
  if (tier === "vuoto" || tier === "luna" || tier === "orbita") return { scene: tier, singularity: false };
  return { scene: "atmosfera", singularity: false };
}

function sceneForMode(now: number): { scene: SceneId; singularity: boolean } {
  if (mode === "done" && debrief) return { scene: debrief.band, singularity: debrief.singularity };
  return { scene: "flight", singularity: false };
}

function paintCanvas(now: number): void {
  if (mode === "play" && transit) {
    drawTransit(drawing, transit.scene, transit.progress, now, transit.singularity, reduced);
    return;
  }
  const { scene, singularity } = sceneForMode(now);
  drawScene(drawing, scene, now, singularity, reduced);
}

function show(html: string): void {
  app!.innerHTML = html;
}

async function load(): Promise<void> {
  show(`<p class="rules">Carico la rotta…</p>`);
  try {
    const response = await fetch("/api/dive");
    const data = (await response.json()) as DiveState;
    applyState(data);
  } catch {
    fail("Segnale perso.");
  }
}

function applyState(data: DiveState): void {
  if (data.status === "empty") {
    mode = "empty";
    date = data.date;
    viewKey = "";
    show(`
      <p class="date">${escapeHtml(formatDayLabel(data.date))}</p>
      <h1>Cosmicomiche</h1>
      <p>Archivio vuoto. Le prossime rotte non sono ancora tracciate.</p>
    `);
    return;
  }
  if (data.status === "ready") {
    mode = "ready";
    date = data.date;
    viewKey = "";
    show(`
      <p class="date">${escapeHtml(formatDayLabel(data.date))}</p>
      <h1>Cosmicomiche</h1>
      <p class="rules">Cinque domande, trenta secondi l'una. Vale la risposta giusta che gli altri non scrivono.</p>
      <button type="button" id="start">Inizia la missione</button>
      <p class="fine">Una partita al giorno, mezzanotte di Roma.</p>
    `);
    document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => void begin());
    return;
  }
  if (data.status === "done") {
    localStorage.removeItem(STORAGE);
    showDone(data.debrief);
    return;
  }
  enterPlay(data.date, data.startedAt, data.token, data.prompts, data.lockedAt);
}

function restartControl(): string {
  if (!import.meta.env.DEV) return "";
  return `<button type="button" id="restart" class="restart">Ricomincia</button>`;
}

function bindRestart(): void {
  document.querySelector("#restart")?.addEventListener("click", () => void restart());
}

async function restart(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>("#restart");
  if (button) button.disabled = true;
  try {
    const response = await fetch("/api/reset", { method: "POST" });
    if (!response.ok) {
      fail("Ricomincia non disponibile.");
      return;
    }
    localStorage.removeItem(STORAGE);
    token = "";
    startedAt = 0;
    lockedAt = emptyLocks();
    transit = null;
    transitPeekIndex = -1;
    prompts = [];
    committed = emptyCommitted();
    peeks = emptyPeeks();
    chosen = emptyCommitted();
    draftIndex = -1;
    pendingDraft = "";
    peeking = false;
    debrief = null;
    submitting = false;
    viewKey = "";
    applyState((await response.json()) as DiveState);
  } catch {
    fail("Segnale perso.");
  }
}

async function begin(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>("#start");
  if (button) button.disabled = true;
  try {
    const response = await fetch("/api/dive", { method: "POST" });
    applyState((await response.json()) as DiveState);
  } catch {
    fail("Segnale perso.");
  }
}

function enterPlay(
  nextDate: string,
  nextStartedAt: number,
  nextToken: string,
  nextPrompts: PromptCard[],
  nextLockedAt: (number | null)[],
): void {
  mode = "play";
  date = nextDate;
  startedAt = nextStartedAt;
  lockedAt = nextLockedAt.length === PROMPT_COUNT ? nextLockedAt : emptyLocks();
  token = nextToken;
  prompts = nextPrompts;
  transit = null;
  transitPeekIndex = -1;
  const stored = readStore();
  committed = stored?.committed?.length === PROMPT_COUNT ? stored.committed : emptyCommitted();
  peeks = stored?.peeks?.length === PROMPT_COUNT ? stored.peeks : emptyPeeks();
  chosen = stored?.chosen?.length === PROMPT_COUNT ? stored.chosen : emptyCommitted();
  draftIndex = stored?.draftIndex ?? -1;
  pendingDraft = stored?.draft ?? "";
  viewKey = "";
  submitting = false;
  tick();
}

function viewOf(phase: PlayPhase): { index: number; transit: boolean; seconds: number; span: number } {
  if (phase.phase === "gap") {
    return {
      index: phase.index,
      transit: true,
      seconds: Math.max(1, Math.ceil(phase.remainingMs / 1000)),
      span: TRANSIT_MS / 1000,
    };
  }
  if (phase.phase === "over") return { index: PROMPT_COUNT - 1, transit: true, seconds: 0, span: TRANSIT_MS / 1000 };
  return {
    index: phase.index,
    transit: false,
    seconds: Math.max(1, Math.ceil(phase.remainingMs / 1000)),
    span: PROMPT_MS / 1000,
  };
}

function tick(): void {
  if (mode !== "play" || submitting) return;
  const input = document.querySelector<HTMLInputElement>("#answer");
  const liveDraft = input?.value ?? pendingDraft;
  if (input && draftIndex >= 0) pendingDraft = liveDraft;
  const clock = clockNow();
  const applied = applyClock(committed, liveDraft.trim(), draftIndex, startedAt, clock.now, clock.locks);
  committed = applied.committed;
  if (applied.phase.phase === "gap") {
    const answer = committed[applied.phase.index] ?? "";
    const known = matchingPeek(peeks[applied.phase.index] ?? null, answer);
    const flight = flightForTier(known?.tier ?? null);
    transit = {
      ...flight,
      progress: 1 - applied.phase.remainingMs / TRANSIT_MS,
    };
    if (!known) ensureTransitPeek(applied.phase.index, answer);
  } else if (applied.phase.phase === "prompt") {
    transit = null;
  }
  if (applied.phase.phase === "over") {
    save();
    void submit();
    return;
  }
  if (applied.phase.phase === "prompt" && committed[applied.phase.index] == null) {
    if (draftIndex !== applied.phase.index) {
      draftIndex = applied.phase.index;
      pendingDraft = "";
    }
  }
  save();
  paintPlay(applied.phase);
}

function peekMarkup(peek: Peek, typed: string): string {
  const corrected =
    peek.canonical && typed && normalize(typed) !== normalize(peek.canonical)
      ? `<p class="alias">vale come ${escapeHtml(peek.canonical)}</p>`
      : "";
  return `<p class="preview tier-${peek.tier ?? "miss"}">${escapeHtml(peek.label)} · ${peek.points}</p>${corrected}`;
}

function renderPreview(index: number): void {
  const box = app!.querySelector<HTMLElement>("[data-preview]");
  const button = app!.querySelector<HTMLButtonElement>("[data-action]");
  if (!box || !button) return;
  const typed = app!.querySelector<HTMLInputElement>("#answer")?.value.trim() ?? "";
  button.disabled = false;
  if (typed !== chosen[index]) {
    chosen[index] = null;
    peeks[index] = null;
  }
  const peek = chosen[index] != null ? peeks[index] : null;
  if (peek && peek.points > 0) {
    const corrected =
      peek.canonical && typed && normalize(typed) !== normalize(peek.canonical)
        ? `<p class="alias">vale come ${escapeHtml(peek.canonical)}</p>`
        : "";
    box.innerHTML = `${corrected}<p class="rules">Riclicca Accendila per confermare.</p>`;
  } else if (peek && peek.points === 0) {
    box.innerHTML = "";
  } else {
    box.innerHTML = "";
  }
  button.textContent = "Accendila";
}

function runningTotal(): number {
  return peeks.reduce((sum, peek, index) => {
    if (committed[index] == null) return sum;
    const match = matchingPeek(peek ?? null, committed[index] ?? "");
    return sum + (match?.points ?? 0);
  }, 0);
}

function totalMarkup(): string {
  const total = runningTotal();
  if (total === 0) return "";
  return `<p class="score">${total}</p>`;
}

function ensureTransitPeek(index: number, answer: string): void {
  if (transitPeekIndex === index || peeking) return;
  transitPeekIndex = index;
  void requestPeek(index, answer);
}

async function requestLock(index: number, value: string): Promise<void> {
  if (peeking) return;
  peeking = true;
  const button = app!.querySelector<HTMLButtonElement>("[data-action]");
  if (button) {
    button.disabled = true;
    button.textContent = "Accendo…";
  }
  try {
    const response = await fetch("/api/lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, index, answer: value }),
    });
    const data = (await response.json()) as LockResult | { error?: string };
    if (!response.ok || !("peek" in data)) {
      const box = app!.querySelector<HTMLElement>("[data-preview]");
      if (box) box.innerHTML = `<p class="rules">${escapeHtml("error" in data && data.error ? data.error : "Segnale perso.")}</p>`;
      return;
    }
    token = data.token;
    lockedAt = data.lockedAt;
    peeks[index] = data.peek;
    committed[index] = data.peek.answer;
    pendingDraft = "";
    draftIndex = -1;
    viewKey = "";
    save();
    tick();
  } catch {
    const box = app!.querySelector<HTMLElement>("[data-preview]");
    if (box) box.innerHTML = `<p class="rules">Segnale perso.</p>`;
  } finally {
    peeking = false;
    const btn = app!.querySelector<HTMLButtonElement>("[data-action]");
    if (btn) { btn.disabled = false; btn.textContent = "Accendila"; }
  }
}

async function checkAnswer(index: number, value: string): Promise<void> {
  if (peeking) return;
  peeking = true;
  const button = app!.querySelector<HTMLButtonElement>("[data-action]");
  const input = app!.querySelector<HTMLInputElement>("#answer");
  if (button) button.disabled = true;
  try {
    const response = await fetch("/api/peek", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, index, answer: value }),
    });
    const data = (await response.json()) as Peek | { error?: string };
    const phase = playheadNow();
    if (phase.phase !== "prompt" || phase.index !== index) return;
    if (!response.ok || !("label" in data)) return;
    const live = input?.value.trim() ?? "";
    if (live !== value) return;
    peeks[index] = data;
    chosen[index] = value;
    save();
    if (data.points > 0) {
      if (input && data.canonical && normalize(value) !== normalize(data.canonical)) {
        input.value = data.canonical;
        chosen[index] = data.canonical;
        peeks[index] = { ...data, answer: data.canonical };
      }
      input?.classList.add("pulse-ok");
      input?.addEventListener("animationend", () => input.classList.remove("pulse-ok"), { once: true });
    } else {
      input?.classList.add("pulse-fail", "shake");
      const clear = () => { input?.classList.remove("pulse-fail", "shake"); };
      input?.addEventListener("animationend", clear, { once: true });
      chosen[index] = null;
    }
    renderPreview(index);
  } catch {
    const box = app!.querySelector<HTMLElement>("[data-preview]");
    if (box) box.innerHTML = `<p class="rules">Segnale perso.</p>`;
  } finally {
    peeking = false;
    if (button) { button.disabled = false; button.textContent = "Accendila"; }
  }
}

async function requestPeek(index: number, value: string): Promise<void> {
  if (peeking) return;
  peeking = true;
  const button = app!.querySelector<HTMLButtonElement>("[data-action]");
  if (button) button.disabled = true;
  try {
    const response = await fetch("/api/peek", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, index, answer: value }),
    });
    const data = (await response.json()) as Peek | { error?: string };
    const phase = playheadNow();
    const during = (phase.phase === "prompt" || phase.phase === "gap") && phase.index === index;
    const live = phase.phase === "prompt"
      ? (app!.querySelector<HTMLInputElement>("#answer")?.value.trim() ?? "")
      : (committed[index]?.trim() ?? "");
    if (!response.ok || !("label" in data)) {
      if (phase.phase !== "prompt" || phase.index !== index) return;
      const box = app!.querySelector<HTMLElement>("[data-preview]");
      if (box) box.innerHTML = `<p class="rules">${escapeHtml("error" in data && data.error ? data.error : "Segnale perso.")}</p>`;
      return;
    }
    if (!during || live !== value) return;
    peeks[index] = data;
    save();
    if (phase.phase === "prompt") renderPreview(index);
    if (phase.phase === "gap") viewKey = "";
  } catch {
    const box = app!.querySelector<HTMLElement>("[data-preview]");
    if (box) box.innerHTML = `<p class="rules">Segnale perso.</p>`;
  } finally {
    peeking = false;
    const current = app!.querySelector<HTMLButtonElement>("[data-action]");
    if (current) current.disabled = false;
  }
}

function clockNow(): { now: number; locks: (number | null)[] } {
  const now = Date.now();
  const locks = lockedAt.map((mark) => (mark != null && mark > now && mark - now < 2_000 ? now : mark));
  return { now, locks };
}

function playheadNow(): PlayPhase {
  const clock = clockNow();
  return playhead(startedAt, clock.now, clock.locks);
}

function paintPlay(phase: PlayPhase): void {
  const view = viewOf(phase);
  const prompt = prompts[view.index];
  const gapPeek = view.transit ? matchingPeek(peeks[view.index] ?? null, committed[view.index] ?? "") : null;
  const key = view.transit ? `gap:${view.index}:${gapPeek?.tier ?? "none"}` : `prompt:${view.index}`;
  const warn = !view.transit && view.seconds <= 5;
  const cue = view.index === PROMPT_COUNT - 1 ? "Arrivo" : "Prossima";
  if (key !== viewKey) {
    viewKey = key;
    const transitPeek = view.transit ? matchingPeek(peeks[view.index] ?? null, committed[view.index] ?? "") : null;
    if (view.transit) {
      show(`
        <p class="date">${escapeHtml(formatDayLabel(date))}</p>
        <p class="progress">Domanda ${view.index + 1} / ${PROMPT_COUNT}</p>
        <p class="prompt">${escapeHtml(prompt?.text ?? "")}</p>
        <p class="locked">${escapeHtml(committed[view.index]?.trim() || "—")}</p>
        ${transitPeek ? peekMarkup(transitPeek, committed[view.index] ?? "") : ""}
        ${totalMarkup()}
      `);
    } else {
      show(`
        <p class="date">${escapeHtml(formatDayLabel(date))}</p>
        <p class="progress">Domanda ${view.index + 1} / ${PROMPT_COUNT}</p>
        <p class="prompt">${escapeHtml(prompt?.text ?? "")}</p>
        <p class="timer${warn ? " warn" : ""}" data-timer>${view.seconds}</p>
        <div class="meter${warn ? " warn" : ""}" aria-hidden="true"><span data-bar></span></div>
        <form>
          <label class="sr" for="answer">Risposta</label>
          <input id="answer" name="answer" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" />
          <div data-preview></div>
          <button type="submit" data-action>Accendila</button>
        </form>
        ${restartControl()}
      `);
    }
    bindRestart();
    if (!view.transit) {
      const bar = app!.querySelector<HTMLElement>("[data-bar]");
      if (bar) bar.style.width = `${(view.seconds / view.span) * 100}%`;
      const answer = app!.querySelector<HTMLInputElement>("#answer");
      if (answer) {
        answer.value = draftIndex === view.index ? pendingDraft : "";
        answer.focus();
        answer.addEventListener("input", () => {
          pendingDraft = answer.value;
          draftIndex = view.index;
          save();
          renderPreview(view.index);
        });
      }
      renderPreview(view.index);
      app!.querySelector("form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const current = playheadNow();
        if (current.phase !== "prompt" || current.index !== view.index) return;
        const value = app!.querySelector<HTMLInputElement>("#answer")?.value.trim() ?? "";
        if (!value) return;
        if (chosen[view.index] != null && chosen[view.index] === value) {
          void requestLock(view.index, value);
          return;
        }
        void checkAnswer(view.index, value);
      });
    }
    return;
  }
  if (!view.transit) {
    const timer = app!.querySelector<HTMLElement>("[data-timer]");
    const bar = app!.querySelector<HTMLElement>("[data-bar]");
    if (timer) {
      timer.textContent = String(view.seconds);
      timer.classList.toggle("warn", warn);
    }
    if (bar) {
      bar.style.width = `${(view.seconds / view.span) * 100}%`;
      bar.parentElement?.classList.toggle("warn", warn);
    }
  }
}

async function submit(): Promise<void> {
  if (submitting) return;
  submitting = true;
  const answers = committed.map((answer) => answer ?? "");
  try {
    const response = await fetch("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, answers }),
    });
    const data = (await response.json()) as { status?: string; debrief?: Debrief; error?: string };
    if (data.status === "done" && data.debrief) {
      localStorage.removeItem(STORAGE);
      showDone(data.debrief);
      return;
    }
    fail(data.error ?? "Segnale perso.", data.error === "Tempo scaduto" ? undefined : () => void submit());
  } catch {
    fail("Segnale perso.", () => void submit());
  }
}

function showDone(next: Debrief): void {
  mode = "done";
  debrief = next;
  viewKey = "";
  const rows = next.rows
    .map((row) => {
      const typed = row.answer.trim();
      const corrected =
        row.canonical && typed && normalize(typed) !== normalize(row.canonical)
          ? `<p class="alias">vale come ${escapeHtml(row.canonical)}</p>`
          : "";
      return `<li>
        <p>${escapeHtml(row.text)}</p>
        <p>${escapeHtml(typed || "—")}</p>
        <p class="tier tier-${row.tier ?? "miss"}">${escapeHtml(row.label)} · ${row.points}</p>
        ${corrected}
      </li>`;
    })
    .join("");
  show(`
    <p class="date">${escapeHtml(formatDayLabel(next.date))}</p>
    <h1>Missione compiuta</h1>
    <p class="band">${escapeHtml(next.bandLabel)}</p>
    <p class="score">${next.total} / ${next.max}</p>
    ${next.singularity ? `<p class="sing">Hai toccato una singolarità.</p>` : ""}
    <ol>${rows}</ol>
    <p class="fine">Una partita al giorno, mezzanotte di Roma.</p>
    ${restartControl()}
  `);
  bindRestart();
}

function fail(message: string, retry?: () => void): void {
  mode = "error";
  errorMessage = message;
  submitting = false;
  viewKey = "";
  show(`
    <h1>Cosmicomiche</h1>
    <p>${escapeHtml(errorMessage)}</p>
    ${retry ? `<button type="button" id="retry">Riprova</button>` : ""}
  `);
  if (retry) document.querySelector("#retry")?.addEventListener("click", retry);
}

function frame(now: number): void {
  if (mode === "play") tick();
  paintCanvas(now);
  loop = requestAnimationFrame(frame);
}

window.setInterval(() => {
  if (mode === "play") tick();
}, 250);

void load();
loop = requestAnimationFrame(frame);
void loop;
