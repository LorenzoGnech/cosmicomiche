import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentDir, loadPromptEntries, loadPrompts, loadSchedule } from "../src/lib/bank";
import { romeDate } from "../src/lib/rome";
import { extendSchedule } from "../src/lib/schedule";
import { validatePrompts } from "../src/lib/validate";

const errors = validatePrompts(loadPromptEntries());
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const existing = loadSchedule();
const result = extendSchedule(loadPrompts(), existing.days, romeDate());
writeFileSync(join(contentDir(), "schedule.json"), `${JSON.stringify({ days: result.days }, null, 2)}\n`);
const today = romeDate();
const runway = result.days.filter((day) => day.date >= today).length;
console.log(`Aggiunti ${result.added.length} giorni. Pista residua da oggi: ${runway}.`);
if (!result.days.some((day) => day.date === today)) {
  console.log("Oggi non è in calendario. Aggiungi prompt e rilancia content:schedule.");
}
