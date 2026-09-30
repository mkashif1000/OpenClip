# Automatic two-face and screen-share splits

In **Process > Batch Processing Options**, enable **Auto-split two faces**,
**Auto-split screen share**, or both. The shared **Center captions while split**
switch places enabled captions at the active divider for split frames only.
All three switches default off and are saved in project styles. Auto-center
speaker is independent. Re-process existing clips to apply changed switches.

## Two-face precision policy

- Reuses the existing MediaPipe face detector, not the sparse/interpolated camera track.
- Checks every output frame's exact source time, including silence/transcript cuts.
- Requires exactly two strong detections (confidence at least 0.85), adequate face
  size, separation, compatible scale, and crops that exclude the other face.
- Requires at least 0.45 seconds of continuous detections and trims 0.06 seconds
  inward at both boundaries (rounded up to whole frames).
- A miss, extra face, ambiguous crop, scene cut, geometry jump, or edited source
  time discontinuity breaks the run. It never fills gaps or extends split presence.
- Export checks the actual decoded frame timestamp against the verified result.
  Separate aspect-correct source crops fill the top and bottom halves.
- Caption relocation is transient, including wrapped and dual-font captions.
  Normal frames restore saved placement; disabled captions remain disabled.

This favors missed split opportunities over false activations, but face detection
is probabilistic: **zero false splits cannot be guaranteed**. Test representative
footage, especially fast cuts, reflections, screen graphics, and partially hidden
faces, before relying on unattended batch output.

## Scope and fallback

Automatic splitting currently applies to portrait **standard** exports. Manual
PIP/split/gameplay/boxed layouts take precedence. B-roll footage stays unsplit;
B-roll dissolves are disabled while auto-split is enabled so a held split image
cannot leak into a normal frame. The Edit preview does not run this export analysis.

Frame-accurate MP4/WebCodecs decoding is required. Analysis failure, unsupported
containers, and video-seek/FFmpeg fallback paths keep the regular layout. Enabling
the option adds a full-frame analysis pass, with the same precision on slow devices.

## Screen share with a corner webcam

**Auto-split screen share** handles a landscape screen recording with a visible
rectangular webcam inset in any corner, including insets offset from the edges.
It requires one strong face, independently verified rectangular inset boundaries,
photographic texture inside, and text/document evidence outside. An off-center
face alone, a logo alone, or a featureless desktop does not qualify.

The existing short-range detector also scans four enlarged quadrants to find
small webcam faces; duplicate reports are merged conservatively without lowering
the 0.85 confidence threshold. Ambiguous additional faces cause rejection.

- Shared content occupies the upper 60%; the speaker occupies the lower 40%.
- A clearly isolated bounded document is enlarged while retaining its full edges.
  Otherwise the screen crop stays full-frame and the original webcam is masked.
- Screen content is **contained**, never stretched or cover-cropped to fill the
  pane. Black letterboxing can be visible to preserve text and aspect ratio.
- The speaker uses the largest correctly proportioned crop within the verified
  inset, avoiding unnecessary face-box zoom that could cut off hair.
- Caption centering follows the 60% divider, or the 50% divider for two-face mode.
- Misses, mode changes, cuts, and inset/content geometry jumps reset guarded runs.

This mode adds several detector passes and pixel checks per output frame, so it
can be substantially slower. Low-contrast or rounded webcam borders, colored or
busy surroundings, tiny/occluded faces, and non-text screen content may stay
unsplit. This is conservative visual detection, not semantic proof of a webcam;
false positives remain possible. Validate a representative video before batch use.

## Regression checks

```powershell
node --test packages/frontend/tests/unit/auto-split.cjs
$env:PLAYWRIGHT_CHANNEL='msedge' # or use an installed Playwright Chromium
npx playwright test packages/frontend/tests/auto-split.spec.ts
npm run build
```

Verified: production build, 18 deterministic policy/analyzer/renderer checks and 7 browser checks
(including the supplied screen-share reference with the actual face detector).
The reference screenshot identified the inset and isolated document, and its
rendered result was inspected. This is not a real-world video accuracy benchmark.
The reference test is opt-in via `OPENCLIP_SCREEN_REFERENCE` pointing at a local
screenshot; the user's screenshot is not copied into the repository. Without
that variable, six browser checks run and the reference check is skipped.

The broader existing preview/export parity suite passed 53/54 checks. Its
`width=1080&height=1920&defaults` case has a font-size/wrapping mismatch between
preview and export with auto-split disabled; it is not addressed by this feature.
