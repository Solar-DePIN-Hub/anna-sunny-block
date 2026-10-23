# Sunny Block: AI Night (Anna App)

Anna App version of [Sunny Block](https://sunny-block.vercel.app), a solar-street platformer, with an AI-native main mode:
**AI NIGHT**: the Gremlin King (Anna LLM) designs a personal level from your run history and an optional wish, then debriefs your run in character with three coaching tips. **Rematch** makes him adapt to how you just played.

## How the AI works
1. `bundle/anna/plan.js` `buildPlanPrompt()` sends your profile (last 8 AI nights: stars, lit %, unmasked, mistakes, tricks used) and your wish (treated as data) to `anna.llm.complete`.
2. The JSON reply is parsed and passed through `validatePlan()`, which clamps every number (difficulty 1–5, 3–6 houses, ≤7 waves 4 s apart, ≤2 leech raids, ...) so any reply is playable. If the reply is bad, it retries once, then shows an error with "Play a classic day".
3. `toLevel()` turns the plan into a level the game engine runs (`C.levels[5]`).
4. After the night, `buildDebriefPrompt()` sends the run record for the debrief. If the LLM is unavailable, a rule-based debrief is shown instead.
5. History is kept in localStorage and mirrored to `anna.storage` key `aiHistory`.

Classic days (MON–FRI + tutorial) work without the LLM.

## Dev
```
anna-app validate --strict
anna-app dev --mock-llm fixtures/llm-mock.jsonl
node test/plan.test.mjs
```
`scripts/sync-from-game.sh` shows the patch against the web game (base commit 46a7ea2).

## Credits
Code and art by Solar DePIN Hub. Robot art from Solarchik CLOCK IN (MIT). Sound is synthesized in code. MIT licence.
