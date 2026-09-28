import { loadPromptEntries } from "../src/lib/bank";
import { validatePrompts } from "../src/lib/validate";

const errors = validatePrompts(loadPromptEntries());
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`Archivio valido: ${loadPromptEntries().length} prompt`);
