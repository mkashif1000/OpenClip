# ClipForge

Turn long-form videos (podcasts, interviews, lectures) into vertical short-form clips with karaoke-style subtitles, title overlays, background music, logo branding, and picture-in-picture layouts — all rendered locally on your machine.

![Stack](https://img.shields.io/badge/node-20%2B-green) ![Platform](https://img.shields.io/badge/platform-Windows-blue) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## ✨ Features

### Core Pipeline
- Import long videos (MP4/MKV/MOV/WEBM) or download directly from YouTube via `yt-dlp`
- Auto-detect viral clips from SRT subtitles using hook keyword + engagement scoring, or load clips from a JSON definition
- Frame-accurate segment extraction via FFmpeg (re-encoded for zero keyframe glitches)
- Remotion-powered rendering — same React components drive both the live browser preview and the final output

### Template Creator
- Configure subtitle styles (font, size, colors, outline, position)
- Configure title overlays (size, colors, opacity, corner radius, vertical position slider)
- Picture-in-Picture layout — drag two boxes on a video frame, adjustable split ratio, aspect-locked resize
- Export format presets: YouTube Shorts, TikTok, Instagram Reels, Horizontal
- Save, load, import, and export templates as JSON

### Per-Clip Processing
- Thumbnails + template dropdown for every clip
- Selective clip rendering with checkboxes
- Re-render individual clips with a different template
- Re-PIP: apply custom PIP settings to a single clip, full-clip or partial (seconds-based time range)

### Background Music & Branding
- Point to a local folder via native folder picker
- Select one or multiple tracks, with per-file volume sliders
- Multiple tracks → randomly assigned per clip
- Upload a logo image with position / size / opacity controls

---

## 🛠 Tech Stack

Monorepo (npm workspaces) with three packages:

| Package | Stack |
|---|---|
| `packages/shared` | Remotion 4 compositions + TypeScript types |
| `packages/server` | Fastify, FFmpeg, `@remotion/renderer`, WebSocket progress |
| `packages/frontend` | React, Vite, Tailwind CSS v4, Zustand, `@remotion/player` |

---

## 📋 Prerequisites

Before you start, make sure these are installed and on your `PATH`:

| Tool | Required | Install |
|---|---|---|
| **Node.js 20+** | Yes | https://nodejs.org/ |
| **FFmpeg** | Yes | https://ffmpeg.org/download.html — verify with `ffmpeg -version` |
| **yt-dlp** | Optional (for YouTube download) | https://github.com/yt-dlp/yt-dlp |

> **Note:** This project is currently built and tested on **Windows 11**. The native folder picker uses a PowerShell dialog — Linux/macOS will need a different folder-picker backend or manual path entry.

---

## 🚀 Running Locally

### 1. Clone the repo

```bash
git clone https://github.com/mkashif1000/ClipForge.git
cd ClipForge
```

### 2. Install dependencies

```bash
npm install
```

This installs dependencies for all three packages via npm workspaces.

### 3. Start both servers

**Easiest (Windows):**

```bash
./run.bat
```

This kills any processes on ports 8000 and 5173, starts the backend and frontend in minimized windows, and opens `http://localhost:5173` in your browser.

**Manual (any OS):**

Run these in two separate terminals:

```bash
# Terminal 1 — backend (Fastify on :8000)
npx tsx packages/server/src/index.ts

# Terminal 2 — frontend (Vite on :5173)
cd packages/frontend && npx vite
```

Then open http://localhost:5173

### 4. Use the app

1. **Create a project** in the sidebar
2. **Import tab** — upload your video, SRT subtitles, and a clips JSON file (or auto-detect clips from the SRT)
3. **(Optional)** Select a music folder and/or upload a logo
4. **Templates tab** — customize subtitle, title, export, and PIP layout settings; save as a named template
5. **Process tab** — assign templates per clip, select which clips to render, click Process
6. Rendered MP4 files appear in `storage/outputs/{project_id}/`

---

## 📂 Project Structure

```
ClipForge/
├── packages/
│   ├── shared/        # Remotion compositions + shared types/utils
│   │   └── src/
│   │       ├── compositions/  # ClipComposition, PIPComposition, HybridComposition, overlays
│   │       ├── types/         # Shared TS interfaces
│   │       └── utils/         # SRT parser, viral scorer, clip loader
│   ├── server/        # Fastify backend
│   │   └── src/
│   │       ├── routes/        # upload, projects, clips, processing, music, templates
│   │       ├── services/      # FFmpeg, job queue, project manager
│   │       ├── remotion/      # Render worker (CommonJS child process)
│   │       └── websocket/     # Progress broadcast
│   └── frontend/      # React + Vite UI
│       └── src/
│           ├── components/    # tabs, styles, pip, music, logo, processing, player
│           ├── stores/        # Zustand state stores
│           └── lib/           # API client
├── run.bat            # Windows launcher
└── storage/           # Runtime data (created automatically, gitignored)
    ├── uploads/       # Uploaded videos / SRT / JSON
    ├── segments/      # Re-encoded clip segments
    ├── outputs/       # Final rendered MP4s
    ├── thumbnails/    # Clip thumbnails
    └── templates/     # Saved templates
```

---

## 📥 Input Formats

- **Video**: MP4, MKV, MOV, AVI, WEBM
- **Subtitles**: SRT (standard format, comma or period milliseconds)
- **Clips JSON**: Array of `{id, title, start_time, end_time, viral_chance_score, text}` with times as `MM:SS` or `HH:MM:SS`
- **Music**: MP3, WAV, OGG, AAC, FLAC, M4A
- **Logo**: Any browser-supported image (PNG recommended for transparency)

### Example Clips JSON

```json
[
  {
    "id": 1,
    "title": "The Most Shocking Revelation",
    "start_time": "04:36",
    "end_time": "05:04",
    "viral_chance_score": "95",
    "text": "Preview of the transcript..."
  }
]
```

---

## ⚙️ How Rendering Works

1. Frontend calls `POST /api/projects/:id/process` with selected clip IDs + per-clip templates/overrides
2. Backend queues a job and processes clips sequentially
3. For each clip:
   - FFmpeg re-encodes a frame-accurate segment (`-preset fast -crf 18`)
   - A render-job JSON is written to `storage/temp/`
   - A child Node process (`render-worker.cjs`) bundles Remotion compositions and runs `renderMedia()` (headless Chrome)
   - Progress streams back over WebSocket to the frontend
4. Output MP4 appears in `storage/outputs/{projectId}/`

Key technical choices:
- `<OffthreadVideo>` instead of `<Video>` for frame-accurate rendering (no Chrome seek race conditions)
- Source video fps is detected and used end-to-end (no 24→30 fps judder)
- Render-worker runs as a separate CommonJS process to bundle Remotion without ESM/tsx conflicts
- Dynamic composition selection: `ClipComposition` / `PIPComposition` / `HybridComposition` based on clip settings

---

## 🧠 Why local-only?

Video rendering is CPU-heavy (60s+ per clip in headless Chrome) and input files are multi-GB. Running on your own machine is faster and cheaper than any serverless setup — no upload time, no per-minute cloud compute cost, no 50MB function size limits.

---

## 🐛 Troubleshooting

**Port 8000 or 5173 already in use**
Run `run.bat` — it auto-kills processes on those ports before starting.

**FFmpeg not found**
Install FFmpeg and make sure `ffmpeg` runs from any terminal. On Windows, add the `bin` folder to your PATH environment variable.

**Rendering produces glitchy / stuttering video**
This was a known issue with Remotion's `<Video>` component and frame-rate mismatches. It should be fixed in the current build (uses `<OffthreadVideo>` + source fps detection). If you still see glitches, delete `storage/segments/` to force fresh re-encodes.

**"delayRender timeout" during rendering**
The render worker couldn't load the input video. Check that the segment was extracted correctly to `storage/segments/` and that the backend is accessible on port 8000.

---

## 📜 License

MIT
