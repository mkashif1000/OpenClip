# Preview and export rendering

The Remotion Player previews media playback. Titles, captions and logos are drawn
on output-resolution canvases by `packages/shared/src/rendering/overlays.ts`.
The Canvas export renderer calls those same functions, including in its worker.
Change an overlay there, rather than adding a separate CSS implementation.

`rendering/geometry.ts` defines split regions, crop transforms, PIP heights and
boxed-video bounds. Preview and export both consume it. Adjacent regions round
their edges, avoiding gaps at resolutions that do not divide evenly. Cropped
previews use a linear source-to-destination mapping and trim to the clip start.

`CompositionOverlays` forwards every overlay setting in standard, split, PIP
and hybrid compositions. Shared style resolvers use the output aspect ratio
for defaults and preserve explicit zero margins and outlines. Logo sizing keeps
the image's natural aspect ratio.

The shared font loader registers normal and bold fonts in `document.fonts` for
preview and `self.fonts` for workers. Paused previews repaint when fonts arrive.
System fonts and failed downloads use the same Arial fallback stack.

## Visual regression checks

From the repository root:

```sh
npm install
npx playwright install chromium
npm run test:visual
npm run build
```

To use an installed Edge browser instead, in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:visual
```

The tests start a dedicated Vite server on port 5179. They mount the actual
Remotion preview, seek a generated MP4 to a nonzero clip start, and compare a
screenshot with the actual export renderer at the same source time. Coverage
includes every caption preset, word colors, transparent titles, wide logos,
custom crops, partial layout ranges, PIP/hybrid, boxed and split layouts,
landscape, 1080p portrait defaults, and zero margins/outlines.

Full-frame comparisons permit up to 2% differing pixels after perceptual
antialiasing filtering: CSS video and Canvas resample fractional crops
differently, especially on a grid. A separate overlay-only comparison allows
less than 0.1% difference with a stricter color threshold and antialiasing
included. Main-thread Canvas and OffscreenCanvas pixels must match exactly;
worker overlay comparisons also check normal and bold system fonts.

Preview, export and difference PNGs are written under ignored `test-results/`.
The tests use Arial and generated media, so they need no API keys, model
downloads or user projects. `tests/fixtures/grid.mp4` is a generated, four-second
640x360 color grid with explicit BT.709 metadata; no personal media is included.
The test harness and fixture are excluded from the production Vite entry point.

These checks cover layout and overlays before lossy H.264 encoding. They do not
assert byte-identical encoded video, cross-browser color management, or temporal
parity for export-only silence cuts, face tracking and automatic B-roll effects.
