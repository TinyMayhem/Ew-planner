# Tiny: Left Unsupervised - Three-stage prototype

A browser-only preview of the first three stages, on a separate feature branch. Not linked from the public arcade until playtesting is complete.

- Open `/tiny-left-unsupervised.html` in the preview deployment.
- Landscape phones recommended. Fullscreen button is available, with desktop keyboard controls.
- Stage 1: opening story, sneaking timing challenge, **five separate stealth licks while Noosh looks away**, random Noosh peeks with a yellow warning, funny consequences if caught, and optional crest clue.
- Stage 2: branching forbidden-button choices, surprise panic decision, five quick dodge prompts, and a seamless transition into Stage 3.
- Stage 3: **Release the Raccoons**. Choose a plan (nuggie bribe, Catalyst's help, or all-out chase); tap twelve visible moving raccoons over three waves, or sweep either half of the playfield. Avoid Baba’s 🎩 decoys. A raccoon carrying a key reveals an archived clue. Mo assigns a comic corner consequence if too many escape, never a game over. At completion, Tiny automatically changes into her sleepy bear onesie and Devi introduces Stage 4.\n- Earn energy from successful challenges and spend it on Puppy Eyes (30), Raccoon Army (60), or Dino Nuggie Rage (100).
- Score, energy, choices, and evidence are checkpointed after Stages 1 and 2 in the browser's local storage; completed achievements and clues are stored separately. Returning after Stage 3 shows the incident report.
- Original compact SVG chibi placeholders visualize character personalities and silhouettes. Replace them with approved sprites based on the supplied reference images in a later art pass.
- Original synthesized browser audio, mute and settings controls. Starts after a user tap.
- Scores are local only. **Do not** reuse the current U-Dodge-only `/api/arcade` scoring endpoint for this game without adding separate game identity and validation.
- No member passcode, roster, R4 records, or Supabase writes are used.

## Testing

```sh
npm test
```

The prototype was also run through an automated Chromium clickthrough for both stages, including dialogue branching, timing/tap challenges, stage transitions, final incident report, and landscape mobile layout.

## Future work

The remaining four full-game stages, final five endings, Noosh's Patience survival mode, shared Tiny-specific leaderboards, full incident archive, and actual high-detail character sprites are deferred. Keep `main` untouched until the preview is approved.

## Stage 2 visibility correction

The initial dodge prompts listed object names but did not show where they were coming from. The revised prototype displays an animated incoming object in a three-lane danger scanner, clearly marking red blocked lanes and the green safe lane. Overhead chandelier and mop hazards block all three lanes and prompt a duck. The same three button controls and swipe gestures remain. The countdown is longer at first and gradually tightens over five obstacles. Mistakes show a comic collision result and the story continues. Puppy Eyes extends the running countdown, and Raccoon Army can still rescue the dodge.

## Stage 3 local browser test results

- Automated Chromium playthrough caught all twelve raccoons over three rounds without page errors.
- Tested 780×360, 844×390 and 1280×720 layouts, including visual moving targets and tap inputs.
- Tested Mo’s consequence branch with too few catches, archive clue unlock, stage-end report, and automatic bear-onesie art.
- Pausing during the raccoon chase freezes the countdown instead of penalizing the player, and Stage 2 to Stage 3 checkpoint resume works.
- **Stage 4 train chase is not yet playable.** The ending currently displays a teaser featuring Tiny and Devi.
