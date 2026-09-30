# Workflow capture provenance

## Source status

These are screenshots of the actual `QuickModeWorkspace` and its production
children, mounted directly by `workflow-capture.tsx`. There is no re-created UI,
fixture toolbar, debug badge, layout override, or changed component wording.

Only the fixture page applies grayscale, disables CSS motion/carets, and hides
the requested Lucide sparkle/star/wand icons with `visibility: hidden` (preserving
their original layout space). No production stylesheet or component is changed.

All project names, instructions, SRT entries, clip suggestions, audio, logos, and
video content are synthetic. Project IDs and timestamps are fixed. Source and
output MP4s are bundled local FFmpeg-generated monochrome test cards:

- `fixtures/workflow-source.mp4`: 1280 × 720, 90 seconds, 30 fps, no audio.
- `fixtures/workflow-output-1.mp4` through `workflow-output-3.mp4`: 360 × 640,
  30 seconds each, 30 fps, no audio. These are **seeded completed outputs**, not
  files rendered by OpenClip. They carry a visible synthetic-demo media caption.
- Background audio is a locally generated one-second PCM tone at low volume.
- The logo is a generated black-and-white `OC` monogram PNG.

The transcript and AI reply are fixture data: no speech model, transcription API,
or chatbot is called. Playwright blocks every non-local HTTP(S) request, including
the preview's Google Fonts stylesheet request; installed system fonts are used.
No API keys, personal data, external browsing, or remote assets are involved.

## Reproduce

From the repository root, using the existing Playwright config:

```powershell
$env:CAPTURE_WORKFLOW = '1'
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npx playwright test packages/frontend/tests/workflow-capture.spec.ts --reporter=line
```

Without `CAPTURE_WORKFLOW=1`, this file is skipped before browser fixtures start.
Edge avoids the unavailable bundled Chromium revision. The config starts/reuses
the local Vite server at `http://127.0.0.1:5179`.

Every capture waits for component hydration, fonts, image decoding, video frames,
and thumbnail loading. CSS motion and input carets are disabled in the fixture.
The viewport and PNG dimensions are exactly **1280 × 900**, at device scale 1.

The test writes seven files to `public/workflow/` and regenerates the typed
`src/components/landing/workflow/workflowCaptures.ts` manifest from final-scroll
`locator.boundingBox()` measurements. Every target is checked against the image
bounds; focus points center the relevant content. The array follows `workflowData`.

| PNG | Actual UI state | Highlight target |
| --- | --- | --- |
| import | Empty Import step / video dropzone | Actual dropzone button |
| transcript | On-device Whisper and AssemblyAI choices | Generate transcript |
| prompt | AI Customize with 3 clips, 30–60 seconds, titles On | Extra instructions |
| llm | Copy Prompt, real chatbot links, synthetic reply pasted | AI clip reply textarea |
| brand | Style step, selected background track and logo controls | Import background audio |
| render | Style applied, Export queue with real per-clip template selector | Process All Clips |
| download | Actual OutputGallery, three seeded finished videos | Download All (.ZIP) |

The render screenshot is a real **ready-to-render** queue. The capture does not
start an expensive render or claim that the synthetic completed state was earned
by a production render. The composition/landing section are outside this harness.

To rebuild the bundled synthetic MP4s on Windows with FFmpeg available, run
`powershell -File packages/frontend/tests/fixtures/workflow-media.ps1` from any
directory, then rerun the capture test.
