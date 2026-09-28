import { answerKeys } from "./score";
import { withinOneEdit } from "./normalize";
import { MIN_ANSWERS } from "./tiers";
import { FAMILIES, PATTERNS, TIERS, type Prompt, type TierId } from "./types";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validatePrompt(prompt: Prompt, file?: string): string[] {
  const where = file ?? prompt.id;
  const errors: string[] = [];
  if (!ID_PATTERN.test(prompt.id)) errors.push(`${where}: id non valido`);
  if (file && file !== `${prompt.id}.json`) errors.push(`${where}: il file non coincide con l'id`);
  if (!FAMILIES.includes(prompt.family)) errors.push(`${where}: famiglia sconosciuta`);
  if (!PATTERNS.includes(prompt.pattern)) errors.push(`${where}: schema sconosciuto`);
  if (!prompt.text.trim()) errors.push(`${where}: testo vuoto`);

  const counts = Object.fromEntries(TIERS.map((tier) => [tier, 0])) as Record<TierId, number>;
  const owner = new Map<string, number>();
  prompt.answers.forEach((answer, index) => {
    if (!TIERS.includes(answer.tier)) {
      errors.push(`${where}: livello sconosciuto in posizione ${index + 1}`);
      return;
    }
    counts[answer.tier] += 1;
    for (const key of answerKeys(answer)) {
      const previous = owner.get(key);
      if (previous !== undefined && previous !== index) {
        errors.push(`${where}: «${key}» appartiene a due risposte`);
      }
      owner.set(key, index);
    }
    if (answerKeys(answer).length === 0) errors.push(`${where}: risposta vuota`);
  });

  for (const tier of TIERS) {
    if (counts[tier] < MIN_ANSWERS[tier]) {
      errors.push(`${where}: ${tier} ha ${counts[tier]} risposte, ne servono ${MIN_ANSWERS[tier]}`);
    }
  }

  const keys = [...owner.entries()];
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const [left, leftOwner] = keys[i];
      const [right, rightOwner] = keys[j];
      if (leftOwner === rightOwner) continue;
      if (left.length < 5 || right.length < 5) continue;
      if (withinOneEdit(left, right)) {
        errors.push(`${where}: «${left}» e «${right}» sono troppo simili per il refuso`);
      }
    }
  }

  return errors;
}

export function validatePrompts(entries: { file?: string; prompt: Prompt }[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.prompt.id)) errors.push(`${entry.prompt.id}: id duplicato`);
    seen.add(entry.prompt.id);
    errors.push(...validatePrompt(entry.prompt, entry.file));
  }
  return errors;
}
