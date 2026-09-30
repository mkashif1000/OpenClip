import { getPerformanceProfile, yieldToBrowser } from './performanceProfile';

/**
 * On-device face tracking (MediaPipe BlazeFace) for auto-centering the
 * speaker. A pre-pass samples the clip, detects all visible faces, then follows
 * one face with temporal continuity. This prevents the crop from jumping to a
 * nearby guest on every frame; a significantly larger/closer face can still
 * take focus, which is a useful visual active-speaker heuristic without cloud
 * diarization or an audio upload.
 *
 * Wasm + model (~1 MB total) load from CDNs on first use and are cached by
 * the browser. If no face is found in enough samples, returns null and the
 * render falls back to the regular centered crop.
 */

export interface FaceTrack {
  /** Smoothed normalized face center (0-1) at an absolute source time, or null. */
  at(t: number): { x: number; y: number } | null;
}

export type FaceTrackingMode = 'smart' | 'largest';

// Wasm loads from a CDN that sets Cross-Origin-Resource-Policy: cross-origin
// (COEP-safe). The model is vendored same-origin (public/models) so it works
// under COEP require-corp without depending on a CDN's CORP headers.
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = '/models/blaze_face_short_range.tflite';

const DETECT_WIDTH = 384;

/** Raw IMAGE-mode detections; consumers must apply their own confidence policy. */
export interface FaceDetection {
  boundingBox?: { originX: number; originY: number; width: number; height: number };
  categories?: Array<{ score: number; categoryName?: string }>;
}

export type FaceDetector = {
  detect(src: CanvasImageSource): {
    detections: FaceDetection[];
  };
};

let detectorPromise: Promise<FaceDetector> | null = null;

export async function getFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.4,
      }) as unknown as FaceDetector;
    })();
    detectorPromise.catch(() => { detectorPromise = null; });
  }
  return detectorPromise;
}

interface Sample { t: number; x: number | null; y: number | null; area?: number }

/**
 * Build a face track for [startSec, endSec] of the source video.
 * Returns null when faces aren't reliably present (caller uses centered crop).
 */
export async function buildFaceTrack(opts: {
  videoOpfsId: string;
  startSec: number;
  endSec: number;
  signal?: AbortSignal;
  mode?: FaceTrackingMode;
}): Promise<FaceTrack | null> {
  const { videoOpfsId, startSec, endSec, signal, mode = 'smart' } = opts;
  const profile = getPerformanceProfile();
  const sampleFps = profile.faceSampleFps;
  const detector = await getFaceDetector();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) return null;

  const samples: Sample[] = [];
  let previous: { x: number; y: number; area: number } | null = null;
  const pushDetection = (t: number, srcW: number, srcH: number, source: CanvasImageSource) => {
    const scale = DETECT_WIDTH / srcW;
    canvas.width = DETECT_WIDTH;
    canvas.height = Math.max(2, Math.round(srcH * scale));
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const res = detector.detect(canvas);
     const faces = (res.detections ?? [])
       .map((d) => d.boundingBox)
       .filter((b): b is NonNullable<typeof b> => !!b)
       .map((b) => ({ x: (b.originX + b.width / 2) / canvas.width, y: (b.originY + b.height / 2) / canvas.height, area: (b.width * b.height) / (canvas.width * canvas.height) }));
     let best = faces.sort((a, b) => b.area - a.area)[0];
     if (mode === 'smart' && previous && faces.length > 1) {
       // Prefer the continuing face; switch only when another face is clearly
       // more prominent, avoiding guest-to-host crop oscillation.
       const scored = faces.map((face) => {
         const distance = Math.hypot(face.x - previous!.x, face.y - previous!.y);
         const prominence = face.area / Math.max(previous!.area, 0.0001);
         return { face, score: distance - Math.min(prominence * 0.12, 0.24) };
       }).sort((a, b) => a.score - b.score);
       best = scored[0]?.face ?? best;
     }
     if (best) previous = best;
     samples.push(
       best
         ? {
             t,
             x: best.x,
             y: best.y,
             area: best.area,
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
       fps: sampleFps,
      signal: signal ?? new AbortController().signal,
         onFrame: (frame, i) => {
           pushDetection(startSec + i / sampleFps, frame.displayWidth, frame.displayHeight, frame);
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
       const steps = Math.max(2, Math.floor((endSec - startSec) * sampleFps));
      for (let i = 0; i < steps; i++) {
        signal?.throwIfAborted();
         const t = startSec + i / sampleFps;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
          video.currentTime = t;
        });
         pushDetection(t, video.videoWidth, video.videoHeight, video);
         await yieldToBrowser();
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
