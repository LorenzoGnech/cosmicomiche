import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Prompt, ScheduleFile } from "./types";

export function contentDir(): string {
  const candidates = [
    process.env.COSMICOMICHE_CONTENT,
    join(process.cwd(), "content"),
    join(dirname(fileURLToPath(import.meta.url)), "../../content"),
    join(dirname(fileURLToPath(import.meta.url)), "../../../content"),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Archivio dei prompt non trovato");
}

export function loadPromptEntries(): { file: string; prompt: Prompt }[] {
  const dir = join(contentDir(), "prompts");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      prompt: JSON.parse(readFileSync(join(dir, file), "utf8")) as Prompt,
    }));
}

export function loadPrompts(): Prompt[] {
  return loadPromptEntries().map((entry) => entry.prompt);
}

export function loadSchedule(): ScheduleFile {
  const path = join(contentDir(), "schedule.json");
  if (!existsSync(path)) return { days: [] };
  return JSON.parse(readFileSync(path, "utf8")) as ScheduleFile;
}
