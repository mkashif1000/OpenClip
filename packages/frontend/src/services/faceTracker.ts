/**
 * On-device face tracking (MediaPipe BlazeFace) for auto-centering the
 * speaker. A pre-pass samples the clip at ~2 fps, detects the largest face
 * per sample, fills gaps, and smooths the path; the renderer then pans the
 * crop window (standard layout) or the PIP speaker box along the track.
 *
 * Wasm + model (~1 MB total) load from CDNs on first use and are cached by
 * the browser. If no face is found in enough samples, returns null and the
 * render falls back to the regular centered crop.
 */

export interface FaceTrack {
  /** Smoothed normalized face center (0-1) at an absolute source time, or null. */
  at(t: number): { x: number; y: number } | null;
}

// Wasm loads from a CDN that sets Cross-Origin-Resource-Policy: cross-origin
// (COEP-safe). The model is vendored same-origin (public/models) so it works
// under COEP require-corp without depending on a CDN's CORP headers.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = '/models/blaze_face_short_range.tflite';

const SAMPLE_FPS = 2;
const DETECT_WIDTH = 384;

type Detector = {
  detect(src: CanvasImageSource): {
    detections: Array<{ boundingBox?: { originX: number; originY: number; width: number; height: number } }>;
  };
};

let detectorPromise: Promise<Detector> | null = null;

async function getDetector(): Promise<Detector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.4,
      }) as unknown as Detector;
    })();
    detectorPromise.catch(() => { detectorPromise = null; });
  }
  return detectorPromise;
}

interface Sample { t: number; x: number | null; y: number | null }

/**
 * Build a face track for [startSec, endSec] of the source video.
 * Returns null when faces aren't reliably present (caller uses centered crop).
 */
export async function buildFaceTrack(opts: {
  videoOpfsId: string;
  startSec: number;
  endSec: number;
  signal?: AbortSignal;
}): Promise<FaceTrack | null> {
  const { videoOpfsId, startSec, endSec, signal } = opts;
  const detector = await getDetector();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) return null;

  const samples: Sample[] = [];
  const pushDetection = (t: number, srcW: number, srcH: number, source: CanvasImageSource) => {
    const scale = DETECT_WIDTH / srcW;
    canvas.width = DETECT_WIDTH;
    canvas.height = Math.max(2, Math.round(srcH * scale));
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const res = detector.detect(canvas);
    const best = (res.detections ?? [])
      .map((d) => d.boundingBox)
      .filter((b): b is NonNullable<typeof b> => !!b)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    samples.push(
      best
        ? {
            t,
            x: (best.originX + best.width / 2) / canvas.width,
            y: (best.originY + best.height / 2) / canvas.height,
          }
        : { t, x: null, y: null },
    );
  };

  // Fast path: decode samples straight from the MP4.
  let decoded = false;
  try {
    const { decodeClipFrames } = await import('./mp4Decoder');
    const { opfsReadFile } = await import('./opfs');
    const file = await opfsReadFile(videoOpfsId);
    await decodeClipFrames({
      file,
      startSec,
      durationSec: Math.max(endSec - startSec, 0.5),
      fps: SAMPLE_FPS,
      signal: signal ?? new AbortController().signal,
      onFrame: (frame, i) => {
        pushDetection(startSec + i / SAMPLE_FPS, frame.displayWidth, frame.displayHeight, frame);
      },
    });
    decoded = true;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    console.warn('Face track decode pass failed, trying <video> seeks:', err);
  }

  // Fallback: sample via a seeking <video> element.
  if (!decoded) {
    try {
      const { opfsGetBlobUrl } = await import('./opfs');
      const url = await opfsGetBlobUrl(videoOpfsId);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error('video load failed'));
      });
      const steps = Math.max(2, Math.floor((endSec - startSec) * SAMPLE_FPS));
      for (let i = 0; i < steps; i++) {
        signal?.throwIfAborted();
        const t = startSec + i / SAMPLE_FPS;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
          video.currentTime = t;
        });
        pushDetection(t, video.videoWidth, video.videoHeight, video);
      }
      URL.revokeObjectURL(url);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      console.warn('Face track seek pass failed:', err);
      return null;
    }
  }

  // Need faces in a reasonable share of samples to trust the track.
  const hits = samples.filter((s) => s.x != null);
  if (!samples.length || hits.length / samples.length < 0.3) return null;

  // Fill gaps with the nearest detection, then smooth (moving average).
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].x == null) {
      const prev = [...samples.slice(0, i)].reverse().find((s) => s.x != null);
      const next = samples.slice(i + 1).find((s) => s.x != null);
      const pick = prev && next
        ? (i - samples.indexOf(prev) <= samples.indexOf(next) - i ? prev : next)
        : prev ?? next;
      samples[i] = { t: samples[i].t, x: pick!.x, y: pick!.y };
    }
  }
  const W = 2; // ±2 samples (~1s window) — kills jitter, keeps slow pans
  const smooth = samples.map((s, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let j = Math.max(0, i - W); j <= Math.min(samples.length - 1, i + W); j++) {
      sx += samples[j].x as number;
      sy += samples[j].y as number;
      n++;
    }
    return { t: s.t, x: sx / n, y: sy / n };
  });

  return {
    at(t: number) {
      if (!smooth.length) return null;
      if (t <= smooth[0].t) return { x: smooth[0].x, y: smooth[0].y };
      const lastS = smooth[smooth.length - 1];
      if (t >= lastS.t) return { x: lastS.x, y: lastS.y };
      for (let i = 0; i < smooth.length - 1; i++) {
        const a = smooth[i], b = smooth[i + 1];
        if (t >= a.t && t <= b.t) {
          const f = (t - a.t) / Math.max(b.t - a.t, 1e-6);
          return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        }
      }
      return { x: lastS.x, y: lastS.y };
    },
  };
}
