# Changelog

All notable changes to OpenClip are documented here. This file is maintained
automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](https://www.conventionalcommits.org/) — see
[CONTRIBUTING.md](./CONTRIBUTING.md).

## 1.0.0 (2026-06-26)

Initial public release of OpenClip — a free, open-source, browser-only
alternative to OpusClip. Everything runs locally in the browser (no backend,
no required paid APIs); deployed as a static site on Vercel.

### Features

- AI clip finding via a free chatbot: copy a generated prompt, run it in any
  free LLM (ChatGPT / Gemini / Claude / Grok / DeepSeek), paste the JSON back —
  no API key required.
- Per-clip editor: visual transcript editing, B-roll lane, drag-to-trim,
  split-screen layouts, and title/font customization.
- Templates: caption-style presets, multi-color titles, 20 fonts, boxed layout,
  and a live-preview customize drawer.
- In-browser rendering pipeline (ffmpeg.wasm + WebCodecs) with social-ready
  H.264 output, background music, and B-roll compositing.
