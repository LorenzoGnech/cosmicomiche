export const FAMILIES = [
  "musica",
  "cinema",
  "geografia",
  "cibo",
  "scienza",
  "storia",
  "sport",
  "lingua",
  "oggetti",
  "natura",
] as const;

export const PATTERNS = [
  "opere-di",
  "elenco",
  "inizia-con",
  "marca",
  "luogo",
  "persona",
  "tempo",
  "genere",
] as const;

export const TIERS = ["atmosfera", "orbita", "luna", "vuoto", "singolarita"] as const;

export type Family = (typeof FAMILIES)[number];
export type Pattern = (typeof PATTERNS)[number];
export type TierId = (typeof TIERS)[number];

export type Answer = {
  tier: TierId;
  canonical: string;
  aliases?: string[];
};

export type Prompt = {
  id: string;
  family: Family;
  pattern: Pattern;
  text: string;
  answers: Answer[];
};

export type ScheduledDay = {
  date: string;
  promptIds: string[];
};

export type ScheduleFile = {
  days: ScheduledDay[];
};
