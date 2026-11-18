# Tiny: Left Unsupervised - Two-stage prototype

A browser-only preview of the first two stages, on a separate feature branch. Not linked from the public arcade until playtesting is complete.

- Open `/tiny-left-unsupervised.html` in the preview deployment.
- Landscape phones recommended. Fullscreen button is available, with desktop keyboard controls.
- Stage 1: opening story, sneaking timing challenge, throne-licking challenge, optional crest clue.
- Stage 2: branching forbidden-button choices, surprise panic decision, five quick dodge prompts, raccoon teaser.
- Earn energy from successful challenges and spend it on Puppy Eyes (30), Raccoon Army (60), or Dino Nuggie Rage (100).
- Score, energy, choices, and evidence are checkpointed after Stage 1 in the browser's local storage; completed achievements and clues are stored separately.
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
