# Cosmicomiche

Daily Italian trivia in the browser. Five shared prompts, 30 seconds each. A rarer accepted answer scores more and the pixel scene moves farther from Earth. Space is the frame; the prompts are ordinary culture.

The playable day is the calendar date in `Europe/Rome`. One attempt per browser. There are no accounts in this version. `astro dev` adds Ricomincia, which clears that attempt; production builds do not.

## Stack

Astro, static pages, Node adapter. API routes set `prerender = false`. The client is one TypeScript module and a canvas. UI text uses Silkscreen because it covers à è é ì ò ù.

## Request flow

| Route | Role |
| --- | --- |
| `GET /api/dive` | `ready` with no prompts, `playing` if this browser already started, `done` with the stored debrief, or `empty` if today is not scheduled |
| `POST /api/dive` | Starts the clock and returns the five prompt texts plus a signed token. A second call returns the same token. |
| `POST /api/peek` | Scores one typed answer for the prompt that is open, or for the transit that just followed it. Returns tier, label, and points. Does not lock it and does not list other answers. |
| `POST /api/lock` | Records the lock time for the open prompt and returns a new token plus that answer's tier and points. The next prompt opens five seconds later. |
| `POST /api/score` | Scores the five locked answers once and stores the debrief in an httpOnly cookie until the next Rome midnight. |
| `POST /api/reset` | Dev only. Deletes the start and result cookies and returns `ready`. Production responds 404. |

The landing screen must call `POST /api/dive` from the start button. A page load that only checks status must not start the timer.

Each prompt lasts up to 30 seconds. The field stays editable. Accendila calls `/api/peek` and shows the tier and points; the field stays editable. A second press sets `committed[index]`. Editing the field clears the match until the text matches the peeked string again. When the player confirms, `/api/lock` ends the prompt. The token stores that lock time, so a refresh keeps the shortened clock. Then a 5 second transit plays: the ship leaves Earth, and a rarer tier flies farther (a miss stays in the atmosphere, a singolarità reaches interstellar space and draws the extra ring). The transit shows the tier, the points, and the running total. If the 30 seconds run out first, the text in the field locks and the same transit plays. After the last transit the run is scored. Scoring rejects a post later than `5 × (30s + 5s) + 15s`. Peek answers only for the prompt the clock currently has open, including that prompt's transit, and only to steer the ship.

Clearing cookies starts a new timer. In dev, Ricomincia on the play screen and the debrief does that and drops the saved draft. That hole closes when runs move to Supabase.

## Tiers

Points live in `src/lib/tiers.ts`, not in the JSON.

| Tier | Points | Meaning |
| --- | --- | --- |
| `atmosfera` | 10 | The answer people type first |
| `orbita` | 30 | One step off that |
| `luna` | 55 | Uncommon and still safe |
| `vuoto` | 80 | Rare and clearly valid |
| `singolarita` | 100 | One or two answers almost nobody reaches |

Anything absent from that prompt's list scores 0 and is labeled Fuori rotta. The debrief shows the player's text and, when that text is not already the canonical spelling, the canonical form. It does not show the rest of the list.

Matching: trim, lowercase, drop apostrophes, strip accents, turn other punctuation into spaces. Then aliases. The same answer also matches when the typed words, after splitting apostrophes and dropping articles and prepositions (`di`, `d'`, `del`, `il`, `la`, …), are exactly the content words of one catalog key, or a subset of only one answer. `Iseo`, `D'iseo` and `lago d'iseo` all score as Lago d'Iseo. A bare shared word such as `lago` matches nothing. A single insertion, deletion or substitution counts only when the typed word and the catalog key are both at least 5 characters and exactly one answer is that close.

The end scene follows the total (max 500):

| Total | Scene |
| --- | --- |
| 0–50 | `atmosfera` |
| 51–150 | `orbita` |
| 151–275 | `luna` |
| 276–400 | `vuoto` |
| 401–500 | `interstellare` |

A `singolarita` hit draws an extra ring on that scene.

## Content

Prompt JSON lives in `content/prompts/`. `content/schedule.json` is the calendar. Both are read with `node:fs` from server code only (`src/lib/bank.ts`, `src/server/`, `src/pages/api/`). Do not import them from `src/pages/index.astro`, `src/scripts/`, or `src/pixel/`.

Each prompt has `id`, `family`, `pattern`, Italian `text`, and `answers[]` of `{ tier, canonical, aliases? }`. The filename is `${id}.json`.

`family` is the topic: `musica`, `cinema`, `geografia`, `cibo`, `scienza`, `storia`, `sport`, `lingua`, `oggetti`, `natura`.

`pattern` is the template: `opere-di`, `elenco`, `inizia-con`, `marca`, `luogo`, `persona`, `tempo`, `genere`. "Una canzone di X" is `opere-di`. Many of those can sit in the bank; a single day cannot stack them.

A scheduled day has five different families and five different patterns. A prompt id is not reused while the unused pool can still fill a day. If the pool can avoid every family used yesterday, it does.

Minimum answers per prompt: atmosfera 5, orbita 4, luna 3, vuoto 2, singolarità 1. Two answers in the same prompt cannot normalize to the same string or sit one edit apart when both keys are at least 5 characters.

The catalog is curated. A true answer that is not listed scores 0 until someone adds it. Famous answers belong in the file; the singolarità is the rare one, not the only correct one.

Refill when `npm run content:schedule` reports a short runway:

1. Add JSON files under `content/prompts/`.
2. `npm run content:validate`
3. `npm run content:schedule`

The scheduler is append-only. Dates already in `schedule.json` stay put. It does not invent a day when the pool cannot fill one; `GET /api/dive` then returns `empty`.

`COSMICOMICHE_SECRET` signs the start token. Local dev falls back to `dev-cosmicomiche-secret`. The process working directory must contain `content/` (the build also copies it next to the server output).

## Later Supabase

Not wired up. The JSON maps onto future tables without a rename:

| JSON | Table |
| --- | --- |
| prompt `id`, `family`, `pattern`, `text` | `prompts` |
| answer `canonical`, `tier` | `answers` |
| aliases | `aliases` |
| `schedule.json` day and position | `schedule` |
| one finished run | `runs` (`user_id`, Rome `play_date`, `score`) |
| each typed answer | `run_answers` |

`runs` is unique on user and Rome date. That is what replaces the cookie.
