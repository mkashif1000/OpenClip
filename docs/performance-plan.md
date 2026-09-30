# Low-end device performance plan

OpenClip keeps the same editing and export features across devices. The browser
chooses a scheduling profile so lower-powered hardware stays responsive instead
of silently dropping functionality.

## Implemented

- `services/performanceProfile.ts` detects CPU cores, memory hints, WebCodecs,
  and WebGPU and returns `high`, `balanced`, or `low` settings.
- WebCodecs decode/encode backpressure uses smaller queues on low-end devices.
- Decoder and fallback seek encoding yield back to the browser periodically.
- Face tracking samples at 1 FPS on low-end devices and 2 FPS elsewhere.
- Whisper uses shorter audio chunks on low-end devices to bound peak memory.
- FFmpeg is loaded lazily. Low-end devices use the single-thread core; capable
  devices use the multi-thread core.
- Video metadata probing uses native browser metadata first, avoiding a large
  FFmpeg download during import in the common case.
- Large videos on balanced/low devices get a background low-resolution proxy for
  thumbnails. Final exports always read the original source file.
- Thumbnail generation uses adaptive sizes, a serialized queue, and bounded URL
  cache eviction.
- Rendering remains sequential and cancelable, with worker-first encoding and
  backpressure to prevent unbounded frame accumulation.

## Next validation targets

1. Test 720p and 1080p exports on a 4 GB / 2-core Windows laptop.
2. Test a large MP4 with face tracking, silence removal, music, and B-roll.
3. Test non-MP4 input to verify the seek/FFmpeg fallback remains usable.
4. Inspect OPFS usage after repeated proxy generation and project deletion.
5. Add a visible performance-profile indicator in Settings/Diagnostics.

## Non-negotiable behavior

- Original media is retained.
- Export resolution and style settings are not silently downgraded.
- AI features remain available; they are scheduled more conservatively.
- A failed proxy or optimization falls back to the original source path.
