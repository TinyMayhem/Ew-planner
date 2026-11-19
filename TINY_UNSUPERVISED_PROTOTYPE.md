# Tiny: Left Unsupervised | Complete six-stage story preview

**Status:** Six connected, playable story stages on a standalone Vercel preview branch. The draft PR has **not** been merged. The live UTW Arcade links and protected features remain unchanged.

## Stages

1. **The Throne Incident:** Sneak toward the throne and collect five licks while Noosh looks away. Timing is unpredictable, failure brings a comic consequence.
2. **DO NOT PRESS:** Touch the red button, survive a surprise panic decision, and dodge five shuffled hazards with clearly marked safe lanes.
3. **Release the Raccoons:** Catch 12 moving raccoons across three randomized waves. Avoid Baba's fake hats, uncover the train-key clue, and face Mo's judgment.
4. **Tiny & Devi's Unauthorized Train Ride:** Look ahead through the conductor cabin windshield and switch among three tracks. Watch approaching objects, duck low bridges, hold the brake, and manage rising boiler pressure with the steam vent. Tequila bottle and empty shot glass appear as visual jokes, not gameplay or driving mechanics. Devi remains Tiny's copilot.
5. **Tiny vs Baba:** 10 rounds of playful PUNCH, DODGE, and SASS challenges. The first four cues use simple actions, later rounds include two-step DODGE → PUNCH combos, and the finisher is last. The specific attack order changes with each run.
6. **The Ultimate Cover-Up:** Explore eight interactive pieces of furniture in the palace to discover four hidden objects; each discovered item needs another tap to conceal it. Three separately visible dirt stains require the 🧴 SPRAY BOTTLE and 🧽 WIPE CLOTH tools, with foaming and cleaning visuals and tap/swipe support. Evidence locations shuffle between runs. Noosh's trophy is an innocent decoy: moving it incurs a penalty. A forgiving timed countdown, three untimed Noosh interrogation questions and Tiny's final defense lead to five potential endings. The total remains seven cleanup tasks, preserving score and finale logic.

## Endings and archive

Four normal outcomes:
- The Chaos Queen
- It Was Baba
- Noosh's Favourite Menace
- The Raccoon Uprising

There is also a fifth **secret ending**, gated by clues collected during the story and a classified envelope found during Stage 6. Do not spoil the secret in user-facing copy.

Noosh's Incident Archives retain endings, achievements and clues in browser-local storage across story replays. Starting a new story resets the active score and checkpoints, but not the archive.

## Scoring and accessibility

- **Consequences, not game over:** missed moves, escaped raccoons, failed cleaning attempts, and wrong dialogue choices continue the story with reduced points or increased suspicion.
- Three earned Chaos Powers share a 100-point meter: Puppy Eyes (30), Raccoon Army (60), and Dino Nuggie Rage (100).
- Landscape mobile-first with a fullscreen option, big on-screen controls, mouse/touch, and desktop keyboard support for applicable stages.
- A pause button freezes timed raccoon/train/fight/cleanup mini-games. Important story choices and interrogation responses are untimed.
- Original synthesized music/effects with user-initiated sound and mute/volume controls.
- All characters use simplified prototype 2D SVG chibi artwork. Polished sprites based on Tiny's seven supplied character references remain to be added.

## Replay variation

The Stage 2 hazard order and approach directions, Stage 3 raccoon lanes/decoys/spawn timing, Stage 4 hazard positions and difficulty-aware sequence, and Stage 5 Baba moves are shuffled when entering their stages. The tutorial ramp, visible safe-lane cues, clue availability, and challenge quantities are preserved. A per-browser last-sequence record avoids immediate repeats.

## Technical boundaries

- Standalone file: `tiny-left-unsupervised.html`
- Repo: `TinyMayhem/Ew-planner`
- Preview feature branch: `feature/tiny-left-unsupervised-prototype-20261118`
- No new server functions or access to protected Buddy Board, Train Desk or R4 records.
- Scores and archives are browser-local. The existing `/api/arcade` endpoint is for U-Dodge and must not be reused until Tiny-specific validated backend scoring is designed.
- Automatic checkpoints save completed stages in the same browser. Stage 6 completion reopens the ending report.
- Full story replay is playable. Individual stage practice, shared rankings, and Noosh's Endless Patience survival mode remain future work.

## Quality checks

- Six-stage source passes JavaScript compilation with a JS engine.
- Stage 6 interaction flow was exercised with a simulated DOM: searching furniture reveals a hidden object, collecting it needs a second tap, stains must be sprayed and wiped, taking Noosh's trophy incurs a penalty, and seven successful tasks trigger the Noosh interrogation and a saved ending. The secret envelope is preserved. It completed without throwing exceptions.
- The fight randomizer generated 65 valid, unique ten-move decks with beginner-friendly rounds and later combos.
- All four main ending choices and the secret ending gate were checked programmatically.
- Regression tests added under `tests/tiny-left-unsupervised.test.mjs`, `tests/tiny-randomized-stages.test.mjs`, and `tests/tiny-stage6.test.mjs`.
- Earlier stages have undergone Chromium tests at landscape phone sizes, but **Stage 6 still requires hands-on mobile browser playtesting** before production release.

## Next steps

Review Stage 6 and its endings in the Vercel preview. Then improve chibi sprite fidelity, implement stage practice, add dedicated server-validated scoreboards and Endless Chaos mode, and finally connect the approved game to the public UTW Chaos Arcade. Keep this PR as a draft until gameplay is signed off.

## Stage 6 interactive cleanup revision

The first Stage 6 version displayed all seven evidence objects openly and asked the player to tap/sweep them. That was too passive. The current version hides **four evidence objects** across **eight furniture hotspots** (curtains, vase, bookshelf, crate, rug, chair, portrait, trunk). The remaining hotspots are empty or contain an innocent trophy. The second tap bags discovered evidence. It also places **three separate stains** around the room. Players select **SPRAY BOTTLE**, tap a stain to create foam, then use **WIPE CLOTH** with a tap or swipe to clean it. Both tools are visible in the lower control bar, with the selected tool highlighted. A timer is still active and can be extended by Puppy Eyes; Raccoon Army can automatically clear one task. Story failure is still consequences-not-game-over. Evidence contents are randomly assigned to furniture on each visit; the same seven-task scoring is retained.

Test status: 26 static/deterministic checks passed via JS harness. A simulated DOM end-to-end check verified discover→collect, spray→foam→wipe, trophy penalty, all seven tasks, classified clue, interrogation, ending archive, and report. **User mobile acceptance and visual polish are still pending.**

## Spoiler-free how-to cards (all six stages)

Each stage now opens with a brief, dismissible **QUICK HOW-TO** card. It gives a practical objective and relevant controls without announcing any surprises or story events:

1. **Keep an Eye on Noosh:** move only when he looks away; freeze when he checks back.
2. **Watch the Danger Lanes:** select the green safe lane; duck when all lanes are red.
3. **Catch the Moving Raccoons:** tap moving targets or sweep a side; avoid fake hats.
4. **Drive from the Conductor Cabin:** switch tracks, duck, brake and vent boiler pressure.
5. **Read Baba's Next Move:** match punch/dodge/sass cues and perform combos in order.
6. **Search, Hide, and Scrub:** find evidence at hiding places; spray and wipe dirt.

Guides display once per stage per active story run and are skipped when that stage is re-entered with the guide already seen (including after a checkpoint reload). A new full story playthrough resets the per-run seen list; the card always has a single **GOT IT, LET'S PLAY** dismissal button. No extra page, backend call or leaderboard change is introduced.

Validation: source compiles; 27 static/regression tests pass; a simulated DOM interaction confirmed the first stage's overlay, dismissal, second-stage overlay, Stage 6 overlay, and suppression on repeat visits.

Note: The larger user-requested Stage 6 visual rework to place hidden objects and swipe-cleanable stains directly on the original throne scene, plus removal of misplaced final-interrogation floating speech bubbles, remains a **separate pending gameplay/art fix**. The current how-to addition does not claim those previous requests are completed.
