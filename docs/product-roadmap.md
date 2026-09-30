# OpenClip product plan

## Product promise

OpenClip is the free, local-first alternative to cloud clipping tools:
unlimited exports, no forced watermark, no upload queue, and transparent
editing decisions. Cloud transcription and B-roll integrations remain optional.

## Phase 1 — Core workflow (implemented / being strengthened)

- Landing page explains the workflow and privacy model.
- Quick Mode and Studio Mode are available from the workspace header.
- Import → subtitles → clips → process is visible as a guided path.
- Import supports SRT, local Whisper, AssemblyAI, JSON, and AI-assisted clip loading.
- Processing supports per-clip templates, selective rendering, retries, and cancel.
- Clip queue has search, filters, sorting, favorites, and score-aware review.
- Keyboard shortcuts: Ctrl/Cmd+1–4 switches workspace steps; Escape cancels rendering.

## Phase 2 — Creator library (implemented foundations)

- Saved templates act as reusable brand kits for captions, titles, layout, and export.
- Templates can be renamed, duplicated, exported, imported, and shared via codes.
- Project metadata backup/restore is available in the sidebar.
- Backups intentionally do not copy multi-GB source media; users re-import media.
- Local storage usage is visible in the project sidebar.

## Phase 3 — Quality and performance (implemented)

- Device profiles adapt preview size, AI chunking, face tracking rate, and queues.
- WebCodecs rendering remains worker-first with bounded backpressure.
- Large videos on low/balanced devices receive a background thumbnail proxy.
- FFmpeg is lazy-loaded; low-end devices use the single-thread core.
- Native browser metadata probing avoids loading FFmpeg during most imports.
- Original media and final export settings remain unchanged.

## Phase 5 — Editing polish (implemented foundations)

- Timeline source lanes now include a lightweight transcript-density waveform.
- Existing transcript word toggles and trim handles remain synchronized with it.
- Optional loudness normalization targets a social-friendly speech mix during
  AAC extraction, including music/SFX and silence-cut exports.
- Edit preview includes an optional title/caption safe-zone guide that is never
  burned into final output.
- Current playhead frame can be exported as a JPEG cover image.

## Phase 4 — Next product upgrades

1. Add draggable per-word waveform markers and direct range editing.
2. Add speaker-aware reframing and multi-face priority controls.
3. Add true media-inclusive `.openclip` packages using chunked ZIP streaming.
4. Add noise reduction, profanity masking, and loudness meters.
6. Add batch project folders and resumable render queues.
7. Add translation captions and downloadable multilingual subtitle tracks.
8. Add a community template library that works without mandatory accounts.

## Phase 6 — Recently implemented

- Clip score explanations now expose hook, curiosity, payoff, length, and cutoff signals.
- Local Whisper transcription now supports auto-detect plus common language selection.
- Score explanations are persisted on automatically detected clips and shown in the Process queue.
- Interrupted render queues are persisted locally and can be resumed from the Process tab.

## Product principles

- Never silently reduce final export quality.
- Explain why an AI clip received its score.
- Keep local processing useful without API keys.
- Make automatic edits reversible.
- Prefer stable sequential work over freezing the browser.
- Treat media storage, API keys, and cloud calls as explicit user choices.
