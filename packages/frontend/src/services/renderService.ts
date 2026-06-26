/**
 * Render service — coordinates client-side video encoding.
 *
 * Pipeline order (first that works wins):
 *   1. Render worker  — mp4 demux+decode → canvas overlays → VideoEncoder,
 *      all off the main thread so long renders don't jank the UI.
 *   2. Main-thread mp4 decode — same pipeline inline (worker unavailable).
 *   3. <video> seek capture — for containers mp4box can't demux.
 *   4. ffmpeg.wasm — chunked RGBA → H.264 when WebCodecs VideoEncoder is absent.
 *
 * The main thread always extracts audio and muxes the final MP4, so ffmpeg.wasm
 * only ever loads once (never inside the worker).
 */

import type { ClipData, StyleConfig, PIPConfig } from '@/types';
import { renderFrame, type LayoutType, type VideoSourceLike } from './canvasRenderer';
import {
  encodeMp4ClipToH264,
  encodeWithBrollToH264,
  emitFrame,
  configureVideoEncoder,
  chunksToAnnexB,
  type ClipEncodeSpec,
  type FaceCenter,
  type BrollSegment,
} from './encodeCore';
import { buildBrollSfxTrack } from './sfxBuilder';
import { ensureFontsLoaded } from './fontLoader';

export interface RenderJob {
  videoOpfsId: string;
  clip: ClipData;
  styleConfig: StyleConfig;
  logoOpfsId?: string | null;
  logoConfig?: { x: number; y: number; size: number; opacity: number } | null;
  musicOpfsId?: string | null;
  musicVolume?: number;
  pipConfig?: PIPConfig | null;
  layoutType: LayoutType;
  pipStartSec?: number;
  pipEndSec?: number;
  outputWidth: number;
  outputHeight: number;
  fps: number;
  /** Source segments to keep (silence/filler removal). Omit for the full clip. */
  keepSegments?: Array<{ start: number; end: number }> | null;
  /** Smoothed face track for auto-centering the speaker. */
  faceTrack?: { at(t: number): { x: number; y: number } | null } | null;
  /** Planned B-roll inserts (source-time spans + downloaded clip files). */
  brollPlan?: Array<{ startSec: number; endSec: number; file: File; clipDurationSec: number }> | null;
  /** Per-region source crops for split / gameplay layouts. */
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }> | null;
}

export interface RenderProgress {
  clipId: string;
  percent: number;
  eta: number;
  currentFps: number;
  phase: 'extracting' | 'encoding' | 'muxing' | 'done';
}

type ProgressCallback = (p: RenderProgress) => void;

let currentController: AbortController | null = null;

/**
 * Render a single clip entirely in the browser.
 * Returns a Blob of the final MP4 file.
 */
export async function renderClip(
  job: RenderJob,
  onProgress: ProgressCallback,
): Promise<Blob> {
  currentController = new AbortController();
  const signal = currentController.signal;

  const { clip, styleConfig, videoOpfsId, outputWidth, outputHeight, fps } = job;

  // Silence/filler cuts: output frames map through a piecewise timeline so
  // video and audio share the exact same cut list.
  const keeps = job.keepSegments?.length ? job.keepSegments : null;
  const timeMap = keeps ? (await import('./silenceCuts')).makeTimeMap(keeps) : null;
  const effectiveDuration = timeMap ? timeMap.duration : clip.duration;
  const totalFrames = Math.ceil(effectiveDuration * fps);
  const frameSrcTime = (i: number): number =>
    timeMap ? timeMap.srcAt(i / fps) : clip.start_time + i / fps;

  const { opfsGetBlobUrl, opfsReadFile } = await import('./opfs');
  const {
    extractAudio, extractConcatAudioAac, isWebCodecsSupported, ensureFFmpegLoaded, muxVideoAudio,
  } = await import('./ffmpegService');

  // H.264 requires even dimensions — round down so the canvas, VideoFrame and
  // encoder all agree.
  const outW = outputWidth - (outputWidth % 2);
  const outH = outputHeight - (outputHeight % 2);

  // Precompute per-frame source times and face centers so the encode spec is
  // fully serializable (plain data) and can cross into the worker unchanged.
  const frameSrcTimes = new Float64Array(totalFrames);
  for (let i = 0; i < totalFrames; i++) frameSrcTimes[i] = frameSrcTime(i);
  let faceCenters: (FaceCenter | null)[] | null = null;
  if (job.faceTrack) {
    faceCenters = new Array(totalFrames);
    for (let i = 0; i < totalFrames; i++) faceCenters[i] = job.faceTrack.at(frameSrcTimes[i]);
  }

  const spec: ClipEncodeSpec = {
    clip,
    styleConfig,
    logoConfig: job.logoConfig ?? null,
    pipConfig: job.pipConfig ?? null,
    layoutType: job.layoutType,
    pipStartSec: job.pipStartSec,
    pipEndSec: job.pipEndSec,
    outputWidth: outW,
    outputHeight: outH,
    fps,
    totalFrames,
    frameSrcTimes,
    faceCenters,
    regionCrops: job.regionCrops ?? null,
  };

  // Logo: a File for the worker (cloned cheaply) + a decoded bitmap for the
  // main-thread paths.
  let logoImg: ImageBitmap | null = null;
  let logoFile: File | null = null;
  if (job.logoOpfsId) {
    try {
      logoFile = await opfsReadFile(job.logoOpfsId);
      logoImg = await createImageBitmap(logoFile);
    } catch {
      console.warn('Failed to load logo image');
      logoFile = null;
      logoImg = null;
    }
  }

  onProgress({ clipId: clip.clip_id, percent: 2, eta: 0, currentFps: 0, phase: 'extracting' });

  // Load caption/title fonts for the main-thread render paths (seek capture +
  // ffmpeg fallback draw with the document FontFaceSet). The worker path loads
  // its own copy. Best-effort — never blocks the render on a font failure.
  await ensureFontsLoaded([
    styleConfig?.subtitle?.font_name,
    styleConfig?.title?.font_name,
    (clip as { edits?: { titleFont?: string } })?.edits?.titleFont,
  ]).catch(() => {});

  // ffmpeg is needed for both audio extraction and the wasm fallback paths.
  signal.throwIfAborted();
  await ensureFFmpegLoaded();

  onProgress({ clipId: clip.clip_id, percent: 4, eta: 0, currentFps: 0, phase: 'encoding' });

  const webCodecsOk = await isWebCodecsSupported();
  const demuxStartSec = keeps ? keeps[0].start : clip.start_time;
  const demuxDurationSec = keeps ? keeps[keeps.length - 1].end - demuxStartSec : clip.duration;

  // Encoding progress maps frames → 4..90%; audio → 92%; mux → 95%; done → 100%.
  const startEnc = performance.now();
  const reportFrames = (done: number) => {
    const elapsed = (performance.now() - startEnc) / 1000;
    const currFps = done / Math.max(elapsed, 0.001);
    const eta = elapsed > 0 ? (totalFrames - done) / Math.max(currFps, 0.01) : 0;
    onProgress({
      clipId: clip.clip_id,
      percent: 4 + (done / Math.max(totalFrames, 1)) * 86,
      eta,
      currentFps: Math.round(currFps),
      phase: 'encoding',
    });
  };

  let mp4Blob: Blob;
  let videoH264: Uint8Array | null = null;
  // B-roll output-frame ranges, populated when the broll encoder actually runs;
  // used to seed the whoosh SFX track at each cut. Stays empty when there's no
  // broll (or it failed), so SFX never fires on plain renders.
  const brollOutSec: number[] = [];

  if (webCodecsOk) {
    // 0) B-roll path — composite stock footage over the planned spans. Runs on
    //    the main thread (multi-source segmented decode). On any failure it
    //    leaves videoH264 null so the normal paths render the clip without B-roll.
    if (job.brollPlan?.length) {
      try {
        const srcFile = await opfsReadFile(videoOpfsId);
        const brolls: BrollSegment[] = [];
        for (const item of job.brollPlan) {
          // Map the source-time span to output frame indices via the (monotonic)
          // frameSrcTimes, so it lands correctly even with silence cuts applied.
          let startFrame = -1;
          let endFrame = -1;
          for (let i = 0; i < totalFrames; i++) {
            const t = frameSrcTimes[i];
            if (startFrame < 0 && t >= item.startSec) startFrame = i;
            if (t < item.endSec) endFrame = i + 1;
          }
          if (startFrame >= 0 && endFrame > startFrame) {
            brolls.push({ file: item.file, startFrame, endFrame, clipDurationSec: item.clipDurationSec });
          }
        }
        if (brolls.length) {
          videoH264 = await encodeWithBrollToH264({
            ...spec, sourceFile: srcFile, logoImg, brolls, signal, onProgress: reportFrames,
          });
          if (videoH264) {
            for (const b of brolls) {
              brollOutSec.push(b.startFrame / fps, b.endFrame / fps);
            }
          }
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        console.warn('B-roll render failed; rendering without B-roll:', err);
        videoH264 = null;
      }
    }

    // 1) Worker path — heavy work off the main thread.
    if (!videoH264) {
      try {
        const srcFile = await opfsReadFile(videoOpfsId);
        videoH264 = await renderViaWorker({
          file: srcFile, logoFile, spec, demuxStartSec, demuxDurationSec, signal, onFrames: reportFrames,
        });
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        console.warn('Worker render unavailable; falling back to main-thread encode:', err);
      }
    }

    // 2) Main-thread mp4 decode (worker missing or failed before producing output).
    if (!videoH264) {
      try {
        const srcFile = await opfsReadFile(videoOpfsId);
        videoH264 = await encodeMp4ClipToH264({
          ...spec, file: srcFile, logoImg, demuxStartSec, demuxDurationSec, signal, onProgress: reportFrames,
        });
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        console.warn('MP4 decode encode failed; trying <video> seek capture:', err);
      }
    }

    // 3) <video> seek capture (non-MP4 containers / exotic codecs).
    if (!videoH264) {
      const videoUrl = await opfsGetBlobUrl(videoOpfsId);
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.preload = 'auto';
      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Video load failed'));
        });
        videoH264 = await encodeViaSeek({ video, spec, logoImg, signal, onProgress: reportFrames });
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        console.warn('Seek capture failed; falling back to ffmpeg.wasm:', err);
      } finally {
        URL.revokeObjectURL(videoUrl);
      }
    }
  }

  // ─── Extract audio (with music + SFX if applicable) ───────────────────────
  // Done AFTER video so we know whether B-roll fired and only mix the whoosh
  // SFX into the audio when there are real cuts to punctuate.
  onProgress({ clipId: clip.clip_id, percent: 92, eta: 0, currentFps: 0, phase: 'extracting' });
  signal.throwIfAborted();
  const music = job.musicOpfsId
    ? { fileId: job.musicOpfsId, volume: job.musicVolume ?? 0.1 }
    : null;

  const SFX_SR = 44100;
  let sfx: { pcm: Uint8Array; sampleRate: number } | null = null;
  if (brollOutSec.length) {
    try {
      const pcm = await buildBrollSfxTrack(brollOutSec, effectiveDuration, SFX_SR);
      if (pcm) sfx = { pcm, sampleRate: SFX_SR };
    } catch (err) {
      console.warn('SFX track build failed; rendering without whoosh:', err);
    }
  }

  const audioAac = keeps
    ? await extractConcatAudioAac(videoOpfsId, keeps, music, sfx)
    : await extractAudio(videoOpfsId, clip.start_time, clip.duration, music, sfx);

  if (videoH264) {
    onProgress({ clipId: clip.clip_id, percent: 95, eta: 0, currentFps: 0, phase: 'muxing' });
    mp4Blob = await muxVideoAudio(videoH264, audioAac, fps);
  } else {
    // 4) Last resort: chunked ffmpeg.wasm encode.
    const videoUrl = await opfsGetBlobUrl(videoOpfsId);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'auto';
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Video load failed'));
      });
      mp4Blob = await encodeWithFFmpegFallback({
        video, spec, logoImg, audioAac, signal,
        onProgress: (pct, etaS) =>
          onProgress({ clipId: clip.clip_id, percent: 4 + pct * 91, eta: etaS, currentFps: 0, phase: 'encoding' }),
      });
    } finally {
      URL.revokeObjectURL(videoUrl);
    }
  }

  // Cleanup
  logoImg?.close();

  onProgress({ clipId: clip.clip_id, percent: 100, eta: 0, currentFps: 0, phase: 'done' });
  return mp4Blob;
}

/**
 * Run the worker render pipeline and resolve with the H.264 Annex B stream.
 * Rejects (so the caller falls back) if the worker can't be created, errors, or
 * the platform lacks Worker/OffscreenCanvas.
 */
function renderViaWorker(opts: {
  file: File;
  logoFile: File | null;
  spec: ClipEncodeSpec;
  demuxStartSec: number;
  demuxDurationSec: number;
  signal: AbortSignal;
  onFrames: (framesDone: number) => void;
}): Promise<Uint8Array> {
  const { file, logoFile, spec, demuxStartSec, demuxDurationSec, signal, onFrames } = opts;

  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return Promise.reject(new Error('Worker/OffscreenCanvas unavailable'));
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }

    const onAbort = () => { try { worker.postMessage({ type: 'abort' }); } catch { /* terminated */ } };
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
      try { worker.terminate(); } catch { /* ignore */ }
    };
    signal.addEventListener('abort', onAbort);

    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m?.type === 'progress') { onFrames(m.framesDone); return; }
      if (m?.type === 'done') { cleanup(); resolve(new Uint8Array(m.h264 as ArrayBuffer)); return; }
      if (m?.type === 'error') {
        cleanup();
        reject(Object.assign(new Error(m.message || 'render worker error'), { name: m.name || 'Error' }));
      }
    };
    worker.onerror = (e) => { cleanup(); reject(new Error(`render worker error: ${e.message || 'unknown'}`)); };
    worker.onmessageerror = () => { cleanup(); reject(new Error('render worker message error')); };

    try {
      worker.postMessage({
        type: 'render',
        file,
        logoFile,
        clip: spec.clip,
        styleConfig: spec.styleConfig,
        logoConfig: spec.logoConfig ?? null,
        pipConfig: spec.pipConfig ?? null,
        layoutType: spec.layoutType,
        pipStartSec: spec.pipStartSec,
        pipEndSec: spec.pipEndSec,
        outputWidth: spec.outputWidth,
        outputHeight: spec.outputHeight,
        fps: spec.fps,
        totalFrames: spec.totalFrames,
        frameSrcTimes: spec.frameSrcTimes,
        faceCenters: spec.faceCenters,
        regionCrops: spec.regionCrops ?? null,
        demuxStartSec,
        demuxDurationSec,
      });
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

/**
 * Main-thread <video> seek capture → H.264 Annex B. Used when mp4box can't
 * demux the source. Slower (bound to seek latency) but works for anything the
 * browser can play.
 */
async function encodeViaSeek(opts: {
  video: HTMLVideoElement;
  spec: ClipEncodeSpec;
  logoImg: ImageBitmap | null;
  signal: AbortSignal;
  onProgress: (framesDone: number) => void;
}): Promise<Uint8Array> {
  const { video, spec, logoImg, signal, onProgress } = opts;

  const encodedChunks: EncodedVideoChunk[] = [];
  let encoderError: Error | null = null;
  const canvas = new OffscreenCanvas(spec.outputWidth, spec.outputHeight);

  const encoder = new VideoEncoder({
    output: (chunk) => encodedChunks.push(chunk),
    error: (e) => { encoderError = e as Error; },
  });

  const configured = await configureVideoEncoder(encoder, spec.outputWidth, spec.outputHeight, spec.fps);
  if (!configured) {
    try { encoder.close(); } catch { /* ignore */ }
    throw new Error('VideoEncoder: no supported H.264 configuration for this output');
  }

  try {
    for (let i = 0; i < spec.totalFrames; i++) {
      signal.throwIfAborted();
      if (encoderError) throw encoderError;
      await seekVideo(video, spec.frameSrcTimes[i]);
      if (encoderError) throw encoderError;
      while (encoder.encodeQueueSize > 30) {
        await new Promise((r) => setTimeout(r, 0));
        signal.throwIfAborted();
        if (encoderError) throw encoderError;
      }
      emitFrame(encoder, canvas, spec, logoImg, i, video as VideoSourceLike);
      onProgress(i + 1);
    }
    if (encoderError) throw encoderError;
    await encoder.flush();
    if (encoderError) throw encoderError;
    return chunksToAnnexB(encodedChunks);
  } finally {
    try { if (encoder.state !== 'closed') encoder.close(); } catch { /* ignore */ }
  }
}

/**
 * ffmpeg.wasm fallback path: render frames and encode in bounded segments so
 * the whole clip's raw RGBA never sits in memory at once (that OOMed on real
 * clips). Each segment is encoded to H.264 Annex B and the segments are
 * concatenated, then muxed with the audio.
 */
async function encodeWithFFmpegFallback(opts: {
  video: HTMLVideoElement;
  spec: ClipEncodeSpec;
  logoImg: ImageBitmap | null;
  audioAac: Uint8Array;
  signal: AbortSignal;
  onProgress: (pct: number, eta: number) => void;
}): Promise<Blob> {
  const { video, spec, logoImg, audioAac, signal, onProgress } = opts;
  const { encodeRgbaFramesToH264, muxVideoAudio } = await import('./ffmpegService');

  const { outputWidth, outputHeight, fps, totalFrames } = spec;

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Bound memory: ~one segment of raw RGBA at a time. A 1080x1920 frame is
  // ~8 MB, so without this a few minutes of footage would buffer many GB.
  const frameSize = outputWidth * outputHeight * 4;
  const MEM_BUDGET = 128 * 1024 * 1024; // ~128 MB of raw frames per segment
  const segFrames = Math.max(1, Math.min(Math.floor(MEM_BUDGET / frameSize), Math.round(fps * 4)));

  const h264Parts: Uint8Array[] = [];
  let batch: Uint8Array[] = [];

  const flushBatch = async () => {
    if (!batch.length) return;
    h264Parts.push(await encodeRgbaFramesToH264(batch, fps, outputWidth, outputHeight));
    batch = [];
  };

  const startTime = performance.now();
  for (let i = 0; i < totalFrames; i++) {
    signal.throwIfAborted();

    const videoTimeSec = spec.frameSrcTimes[i];
    await seekVideo(video, videoTimeSec);

    renderFrame({
      video, canvas,
      currentTimeSec: videoTimeSec,
      clipStartSec: spec.clip.start_time,
      clip: spec.clip,
      styleConfig: spec.styleConfig,
      logoImg,
      logoConfig: spec.logoConfig ?? null,
      pipConfig: spec.pipConfig ?? null,
      layoutType: spec.layoutType,
      pipStartSec: spec.pipStartSec,
      pipEndSec: spec.pipEndSec,
      width: outputWidth, height: outputHeight,
      faceCenter: spec.faceCenters?.[i] ?? null,
    });

    // getImageData returns a fresh buffer each call, so this view is safe to keep.
    const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
    batch.push(new Uint8Array(imageData.data.buffer));
    if (batch.length >= segFrames) await flushBatch();

    const elapsed = (performance.now() - startTime) / 1000;
    const eta = elapsed > 0 ? (totalFrames - i) / Math.max(i / elapsed, 0.01) : 0;
    onProgress((i / Math.max(totalFrames, 1)) * 0.9, eta); // render+segment encode = 90%
  }
  await flushBatch();

  // Concatenate the per-segment Annex B streams.
  let total = 0;
  for (const p of h264Parts) total += p.length;
  const videoH264 = new Uint8Array(total);
  let off = 0;
  for (const p of h264Parts) { videoH264.set(p, off); off += p.length; }

  onProgress(0.95, 0);
  return muxVideoAudio(videoH264, audioAac, fps);
}

/**
 * Seek video to exact time and wait for the seeked event.
 */
function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - timeSec) < 0.001) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = timeSec;
  });
}

/**
 * Cancel the currently running render.
 */
export function cancelRender(): void {
  currentController?.abort();
  currentController = null;
}

/**
 * Trigger browser download of a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Generate a safe filename for a rendered clip.
 */
export function getClipFilename(clip: ClipData, index: number): string {
  const safe = (clip.title || '')
    .slice(0, 30)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `clip_${String(index).padStart(2, '0')}_${safe || 'untitled'}.mp4`;
}
