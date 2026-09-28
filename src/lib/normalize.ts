const GLUE = new Set([
  "il", "lo", "la", "i", "gli", "le", "l",
  "un", "uno", "una",
  "di", "d", "del", "dello", "della", "dei", "degli", "delle",
  "da", "dal", "dallo", "dalla", "dai", "dagli", "dalle",
  "a", "al", "allo", "alla", "ai", "agli", "alle",
  "in", "nel", "nello", "nella", "nei", "negli", "nelle",
  "su", "sul", "sullo", "sulla", "sui", "sugli", "sulle",
  "con", "col", "collo",
  "e", "ed", "o",
]);

export function contentTokens(raw: string): string[] {
  const spaced = raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return [];
  return [...new Set(spaced.split(" ").filter((token) => token && !GLUE.has(token)))];
}

export function normalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (la > lb) i += 1;
    else if (lb > la) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < la || j < lb) edits += 1;
  return edits <= 1;
}
