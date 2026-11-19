# Tiny: Left Unsupervised | Four playable stages

A standalone, public browser-game preview on the `feature/tiny-left-unsupervised-prototype-20261118` feature branch. **Not merged into main or linked from the live arcade.**

## Playable progression

1. **The Throne Incident:** Noosh peeks back unpredictably; collect five separate licks while his back is turned.
2. **DO NOT PRESS:** Branching choices, a timed panic decision, three clearly marked dodge lanes and visibly incoming obstacles.
3. **Release the Raccoons:** Chase three waves of moving raccoons by tapping or sweeping; Baba's decoy hats, Cat's help, Mo's consequences, and the key clue.
4. **Tiny & Devi's Unauthorized Train Ride:** Animated three-track obstacles, big LEFT/CENTRE/RIGHT buttons, a timed DUCK move for low bridges, and hold-to-BRAKE to slow approaching hazards. After four obstacles, the raccoon changes railway signals, triggering a time-limited decision before the remaining hazards. Devi supports Tiny and catches mistakes without a game over.

Tiny boards with a **closed tequila bottle** and produces an **empty shot glass** in the midstage dialogue as visual gags. The bottle is put away for active driving, and no drinking-based gameplay or driving bonus is used.

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
- 1280×720 brake and pause checks passed: holding the brake slowed hazard progress, and pause froze the train clock.
- Intro, bottle, train track, shot-glass scene and ending screenshots inspected.
- JavaScript syntax checked with Node `--check`; static tests in `tests/tiny-left-unsupervised.test.mjs` cover all four stages and no unauthorized score submissions.
- Please still review in your mobile browser before production deployment.

## Next

Stage 5 is the playful Tiny vs Baba punch/dodge/sass fight. Stage 6 is The Ultimate Cover-Up with Noosh's interrogation, followed by endings and Endless Chaos Mode. Full-reference sprite polish and Tiny-specific shared leaderboards remain future work.
