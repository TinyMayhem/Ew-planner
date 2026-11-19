# Tiny: Left Unsupervised | Five playable stages

A standalone, public browser-game preview on the `feature/tiny-left-unsupervised-prototype-20261118` feature branch. **Not merged into main or linked from the live arcade.**

## Playable progression

1. **The Throne Incident:** Noosh peeks back unpredictably; collect five separate licks while his back is turned.
2. **DO NOT PRESS:** Branching choices, a timed panic decision, three clearly marked dodge lanes and visibly incoming obstacles.
3. **Release the Raccoons:** Chase three waves of moving raccoons by tapping or sweeping; Baba's decoy hats, Cat's help, Mo's consequences, and the key clue.
4. **Tiny & Devi's Unauthorized Train Ride:** A conductor-cabin view with a panoramic windshield looking out onto three perspective railway tracks, visible incoming obstacles, large LEFT/CENTRE/RIGHT controls, DUCK for low bridges, and hold-to-BRAKE to slow approaching hazards. Added a live BOILER PRESSURE gauge and tappable VENT STEAM button so players balance train driving and boiler pressure between incoming hazards. Braking increases the rate of pressure buildup. A high-pressure vent awards bonus points, while overheating produces a brief steam burst, cabin shake, Devi commentary and a comic penalty. After four obstacles, the raccoon changes railway signals, triggering a time-limited decision before the remaining hazards. Devi supports Tiny and catches mistakes without a game over.

5. **Tiny vs Baba:** Ten rounds of chibi sparring using clearly telegraphed PUNCH, DODGE, and SASS cues, with two-step DODGE → PUNCH combos, faster timers, streak bonuses, and funny bonks for mistakes instead of game over. Tiny's earned powers carry through the fight, with Raccoon Army distracting Baba, Puppy Eyes extending the timer, and Dino Nuggie Rage boosting points. An achievement and secret clue can be uncovered. Ends with Noosh asking why there is a boxing ring and a teaser for Stage 6.\n\nTiny boards with a **closed tequila bottle** and produces an **empty shot glass** in the midstage dialogue as visual gags. The bottle is put away for active driving, and no drinking-based gameplay or driving bonus is used.

## Controls

- Landscape mobile (fullscreen available); left, centre and right buttons, swipe sideways to change one track, swipe down or press DUCK for low bridges, hold BRAKE to slow the approaching object.
- Desktop: left/right arrows or A/D move across tracks; down arrow or S ducks; hold Space to brake.
- Red railway tracks are blocked; green tracks are clear. On overhead hazards all three tracks are blocked and DUCK is required.
- Each hazard becomes faster. Failures trigger short cartoon consequences but the story continues.
- Puppy Eyes (30) buys more reaction time, Raccoon Army (60) clears the current obstacle, and Dino Nuggie Rage (100) boosts earned chaos score.
- Music and effects start after player interaction. Separate settings, fullscreen and pause/resume are provided.

## Persistence and privacy

- Local browser save/checkpoints after stages. Stage 3 checkpoint enters Stage 4; completed Stage 4 presents the incident report and a teaser for Tiny vs Baba.
- Archive achievements and clues are local.
- No access to private UTW member tools; no `/api/arcade` score posting. Current U-Dodge scoreboard is not reused.

## Validation

- Chromium end-to-end playthrough tested at 780×360 and 844×390, including all nine train hazards, midstage panic, power meters, scene transitions and final report.
- 1280×720 brake and pause checks passed: holding the brake slowed hazard progress, and pause froze the train clock. The new cabin view was checked at 780×360, 844×390 and 1280×720, with vent input, pressure buildup, and safe lane changes verified. An overheat case resets boiler pressure and displays Devi's reaction. Pause freezes pressure.
- Intro, bottle, train track, shot-glass scene and ending screenshots inspected.
- JavaScript syntax checked with Node `--check`; static tests in `tests/tiny-left-unsupervised.test.mjs` cover all four stages and no unauthorized score submissions.
- Please still review in your mobile browser before production deployment.

## Next

Stage 6 is The Ultimate Cover-Up with Noosh's interrogation, followed by endings and Endless Chaos Mode. Full-reference sprite polish and Tiny-specific shared leaderboards remain future work.

## Stage 4 cabin redesign, based on gameplay feedback

The original Stage 4 looked too much like a three-column obstacle quiz. The new version places players in the locomotive cabin with a forward-facing windshield, three receding perspective tracks, scenery, driver/codriver portraits and a control dashboard. Boiler pressure rises throughout the ride; venting it is the second interactive task during the interval before each obstacle. Bonus points for skillful high-pressure vents, harmless comedic consequences if pressure maxes out. Active driving and reaction timing remain readable. The tequila bottle and empty shot glass remain cutscene visual props only; no drinking mechanic is implemented.

## Stage 4 character-overlap fix and Stage 5 QA

- **Bug fixed:** Dialogue with a `tiny` speaker no longer defaults her right-hand companion to Baba. In Stage 4 it keeps Devi as the copilot; during cabin action the background portrait pair is hidden because the cockpit already draws Tiny and Devi.
- **Stage 4 end:** Baba challenges them offscreen via station speakers. He is not visually introduced until entering Stage 5.
- **Stage 5:** Mobile landscape screenshots inspected at 780×360 and 844×390. Browser playthrough tested 10 successful rounds, including timed dodge/punch combinations, as well as a deliberate wrong move, and a separate transition test showed Stage 5 completing with no game over. Source JavaScript parses with Node.
- **Persistence:** Completion of Stage 4 now checkpoints the beginning of Stage 5; Stage 5 completion checkpoints the Stage 6 teaser. Existing U-Dodge server endpoints remain untouched.
- Final character sprite art is still provisional; five endings, actual Stage 6, Endless Mode, and shared leaderboards are not yet implemented.
