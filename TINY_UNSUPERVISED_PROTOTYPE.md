# Tiny: Left Unsupervised | Complete six-stage story preview

**Status:** Six connected, playable story stages on a standalone Vercel preview branch. The draft PR has **not** been merged. The live UTW Arcade links and protected features remain unchanged.

## Stages

1. **The Throne Incident:** Sneak toward the throne and collect five licks while Noosh looks away. Timing is unpredictable, failure brings a comic consequence.
2. **DO NOT PRESS:** Touch the red button, survive a surprise panic decision, and dodge five shuffled hazards with clearly marked safe lanes.
3. **Release the Raccoons:** Nine-hole, net-catching, whack-a-mole-style challenge. Raccoons visibly pop up and can be caught independently with simultaneous finger taps; the faster key carrier hops between holes and always appears with another raccoon. Three randomized waves still provide 12 catchable raccoons and three Baba hat decoys. The hidden key clue and Mo's consequences are preserved.
4. **Tiny & Devi's Unauthorized Train Ride:** Look ahead through the conductor cabin windshield and switch among three tracks. Watch approaching objects, duck low bridges, hold the brake, and manage rising boiler pressure with the steam vent. Tequila bottle and empty shot glass appear as visual jokes, not gameplay or driving mechanics. Devi remains Tiny's copilot.
5. **Tiny vs Baba:** 10 rounds of playful PUNCH, DODGE, and SASS challenges. The first four cues use simple actions, later rounds include two-step DODGE → PUNCH combos, and the finisher is last. The specific attack order changes with each run.
6. **The Ultimate Cover-Up:** Actual throne-room scene, not a menu or labelled furniture grid. Four tiny evidence objects are scattered amongst palace decorations in shuffled positions, along with one Noosh trophy decoy. Three marks sit directly on the throne; players select spray and then rub each stain with finger swipes, watching it fade gradually. Taps also work as an accessibility fallback. The cleanup has a gentler Noosh-return countdown and the usual consequences, never a game over. During the interrogation, floating speech bubbles are hidden and all Noosh questions, replies and the final defense are shown in the bottom dialogue panel.

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

## Gameplay feedback revision: netting, hidden objects, dialogue alignment

- **Stage 3:** Old horizontally running raccoons and side-sweep UI replaced with a 3×3 field of popping raccoons. No shared capture cooldown on direct taps; two independent holes can be netted simultaneously, including multitouch on phones. Key carrier's ~850ms pop window and ~250ms hops make it distinct from ~1.9s regular raccoons. Key spawns paired with another real raccoon. A net graphic animates on successful catches.
- **Stage 6:** Uses the original visual throne scene behind a full-scene transparent interactive layer. Context decorations and subtly scattered small clickable objects create a Where's-Waldo-style hunt without rectangular item buttons or visible item names. Four evidence clues including the sealed envelope plus a Noosh trophy decoy are distributed among twelve plausible places. Three marks are placed directly over the throne. Spray gives foam, then pointer movement steadily fades marks and clears them after sufficient scrubbing; repeated taps provide a non-swipe fallback. Scene timer extended for a more relaxed final cleanup.
- **Dialogue:** All Stage 6 floating speech bubbles are suppressed. Noosh's questions, official responses and the final defense show their words in the bottom panel, avoiding misattribution to Tiny's portrait.
- **Verified:** Existing regression suite of 27 checks passed. A simulated-DOM complete run caught all 12 raccoons across three waves, confirmed simultaneous key+buddy presence, cleared the four scattered clues and three scrubbed stains, triggered the trophy penalty, and reached an ending recorded in the archive.
- **Pending:** Real-phone landscape visual acceptance and sprite polish. Do not merge the draft PR until those are reviewed.

## Stage 6 evidence discoverability fix

Player feedback confirmed the raccoon net stage and tactile throne scrubbing work well, but the hidden-object portion did not say **what objects count**.

- Stage 6 now explicitly names the four required objects before gameplay: 🦝 raccoon fur, 🔑 train keys, 🥊 Baba's boxing gloves, and ✉️ sealed letter.
- A slim in-scene **evidence checklist** remains visible above the throne with four item labels. The appropriate item is checked off in green after each successful collection.
- Each collection briefly displays a floating **FOUND: [ITEM]** confirmation. The four objects remain scattered in random positions.
- Replaced misleading, passive **LOOK FOR CLUES** mode with an actual **HINT** action. Tapping it briefly highlights one uncleared evidence object and indicates its general area, with a nine-second cooldown. The hint reveals no secret ending details.
- The Stage 6 How-to card and initial mission text now state the four-item objective and warn that Noosh's trophy is not evidence.
- The existing net-catching game, finger-scrub stain cleaning, Noosh countdown, consequences, secret envelope clue, and final interrogation are unchanged.

Validation: 28 regression checks passed. Simulated UI confirmed the checklist exists, one hint highlights an uncleared object, the corresponding checklist entry turns green on collection, the floating feedback appears, and the cooldown blocks repeat hint spam. User mobile acceptance remains pending.

## Raccoon net game reaction-time adjustment

The fast key-carrying raccoon was too difficult to net and the stage began too abruptly. The updated Stage 3 now displays a large **3, 2, 1, GO!** overlay **before every wave**. No raccoons spawn and no taps can catch anything until GO has finished. The 3.65-second readiness/GO animation happens **before** the 17-second catching clock starts. It freezes correctly during pause.

The key carrier now stays up for **2,500 ms** at standard speed, up from **850 ms**, and hops every roughly **780 to 980 ms** instead of every 220 to 320 ms. It still moves faster than a normal raccoon and still spawns simultaneously with another raccoon. Normal raccoons also have a little more reaction time, while the nuggie and sprint strategies maintain their existing speed effects. Multi-touch catch, nine holes, net animation, train-key clue, three waves and scoring remain unchanged.

Validation: 29 static/deterministic checks pass. Simulated full three-wave gameplay confirmed the countdown blocks spawns before GO, pauses without consuming the countdown, all 12 raccoons can be netted, and the key carrier appears paired with another raccoon and remains catchable for 2.5 seconds at default speed. This is still an unmerged gameplay preview requiring Tiny's phone review.
