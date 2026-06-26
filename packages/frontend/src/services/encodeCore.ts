/**
 * Encode core — DOM-free WebCodecs H.264 helpers shared by the main thread
 * (renderService) and the render worker (renderWorker).
 *
 * Nothing in this module touches `document` or any other main-thread-only API,
 * so it bundles cleanly into a Web Worker. The actual per-frame overlay drawing
 * lives in canvasRenderer (also OffscreenCanvas-based), and frame decoding in
 * mp4Decoder — both worker-safe. Keeping this logic in one place guarantees the
 * worker and the main-thread fallback produce byte-for-byte identical output.
 */

import type { ClipData, StyleConfig, PIPConfig } from '@/types';
import { renderFrame, type LayoutType, type VideoSourceLike } from './canvasRenderer';

export type FaceCenter = { x: number; y: number };

/**
 * Bitrate scaled to resolution and frame rate (~0.25 bits/pixel/frame), so
 * 720x1280@30 gets ~7 Mbps and 1080x1920@30 gets ~16 Mbps — comparable to
 * platform "high quality" uploads instead of a fixed 5 Mbps for everything.
 */
export function pickBitrate(width: number, height: number, fps: number): number {
  return Math.min(Math.max(Math.round(width * height * fps * 0.25), 4_000_000), 16_000_000);
}

/**
 * Find a supported H.264 encoder configuration for the given dimensions and
 * apply it. Tries higher profiles/levels first and several acceleration modes,
 * validating each with isConfigSupported() so we never call encode() on an
 * encoder whose config was rejected asynchronously ("Encoder must be configured
 * first"). Returns false if nothing is supported (caller falls back to ffmpeg).
 */
export async function configureVideoEncoder(
  encoder: VideoEncoder,
  width: number,
  height: number,
  fps: number,
): Promise<boolean> {
  // High@4.0, Main@4.0, Baseline@4.0, Baseline@3.1 — 4.0 comfortably covers
  // 720x1280 and 1080x1920, unlike 3.1 which is exactly at its limit here.
  const codecs = ['avc1.640028', 'avc1.4D0028', 'avc1.42E028', 'avc1.42E01F'];
  const accels: HardwareAcceleration[] = ['no-preference', 'prefer-hardware', 'prefer-software'];

  for (const codec of codecs) {
    for (const hardwareAcceleration of accels) {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        framerate: fps,
        bitrate: pickBitrate(width, height, fps),
        hardwareAcceleration,
        avc: { format: 'annexb' },
      };
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
          encoder.configure(support.config ?? config);
          return true;
        }
      } catch {
        // Unsupported combination — try the next one.
      }
    }
  }
  return false;
}

/**
 * Convert WebCodecs encoded chunks to an H.264 Annex B byte stream.
 */
export function chunksToAnnexB(chunks: EncodedVideoChunk[]): Uint8Array {
  const buffers: Uint8Array[] = [];
  let totalSize = 0;

  for (const chunk of chunks) {
    const buf = new Uint8Array(chunk.byteLength);
    chunk.copyTo(buf);
    // Add Annex B start code if not present
    if (buf[0] !== 0 || buf[1] !== 0 || buf[2] !== 0 || buf[3] !== 1) {
      const withStartCode = new Uint8Array(4 + buf.length);
      withStartCode[0] = 0; withStartCode[1] = 0; withStartCode[2] = 0; withStartCode[3] = 1;
      withStartCode.set(buf, 4);
      buffers.push(withStartCode);
      totalSize += withStartCode.length;
    } else {
      buffers.push(buf);
      totalSize += buf.length;
    }
  }

  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

/** Plain, structured-cloneable description of a render job for the encode core. */
export interface ClipEncodeSpec {
  clip: ClipData;
  styleConfig: StyleConfig;
  logoConfig?: { x: number; y: number; size: number; opacity: number } | null;
  pipConfig?: PIPConfig | null;
  layoutType: LayoutType;
  pipStartSec?: number;
  pipEndSec?: number;
  outputWidth: number;
  outputHeight: number;
  fps: number;
  totalFrames: number;
  /** Source time (seconds) for each output frame index. Length === totalFrames. */
  frameSrcTimes: Float64Array;
  /** Normalized face center per output frame, or null to disable panning. */
  faceCenters: (FaceCenter | null)[] | null;
  /** Per-region source crops for split / gameplay layouts. */
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }> | null;
}

/**
 * Draw output frame `i` from a pixel source (a decoded VideoFrame on the fast
 * path, or a seeked <video> element on the main-thread fallback) onto `canvas`,
 * wrap it in a VideoFrame, and hand it to the encoder.
 */
export function emitFrame(
  encoder: VideoEncoder,
  canvas: OffscreenCanvas | HTMLCanvasElement,
  spec: ClipEncodeSpec,
  logoImg: ImageBitmap | HTMLImageElement | null,
  i: number,
  source: VideoSourceLike,
): void {
  const srcT = spec.frameSrcTimes[i];
  renderFrame({
    video: source,
    canvas,
    currentTimeSec: srcT,
    clipStartSec: spec.clip.start_time,
    clip: spec.clip,
    styleConfig: spec.styleConfig,
    logoImg,
    logoConfig: spec.logoConfig ?? null,
    pipConfig: spec.pipConfig ?? null,
    layoutType: spec.layoutType,
    pipStartSec: spec.pipStartSec,
    pipEndSec: spec.pipEndSec,
    width: spec.outputWidth,
    height: spec.outputHeight,
    faceCenter: spec.faceCenters?.[i] ?? null,
    regionCrops: spec.regionCrops ?? undefined,
  });
  const bitmap = (canvas as OffscreenCanvas).transferToImageBitmap();
  const frame = new VideoFrame(bitmap, {
    timestamp: Math.round((i / spec.fps) * 1_000_000), // microseconds
    duration: Math.round((1 / spec.fps) * 1_000_000),
  });
  encoder.encode(frame, { keyFrame: i % Math.round(spec.fps * 2) === 0 });
  frame.close();
  bitmap.close();
}

export interface Mp4EncodeOpts extends ClipEncodeSpec {
  /** Source MP4 file (read lazily via slice — never fully buffered). */
  file: File;
  /** Already-decoded logo bitmap, or null. */
  logoImg: ImageBitmap | null;
  demuxStartSec: number;
  demuxDurationSec: number;
  signal: AbortSignal;
  /** Reports the number of frames encoded so far. */
  onProgress: (framesDone: number) => void;
}

/**
 * Fast path encode: demux + decode the clip's samples directly with WebCodecs
 * (mp4Decoder), draw overlays, and encode to an H.264 Annex B byte stream.
 *
 * Frame-accurate and not bound to realtime playback, so output is identical on
 * slow and fast machines. Throws if the source can't be demuxed/decoded (the
 * caller then falls back to a seeking <video> element on the main thread).
 *
 * Audio extraction and final muxing are intentionally left to the caller so
 * this can run inside a Web Worker without loading ffmpeg there.
 */
export async function encodeMp4ClipToH264(opts: Mp4EncodeOpts): Promise<Uint8Array> {
  if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('WebCodecs/OffscreenCanvas unavailable in this context');
  }

  const { file, logoImg, demuxStartSec, demuxDurationSec, fps, totalFrames, signal, onProgress } = opts;
  const { decodeClipFrames } = await import('./mp4Decoder');

  const encodedChunks: EncodedVideoChunk[] = [];
  let encoderError: Error | null = null;
  const canvas = new OffscreenCanvas(opts.outputWidth, opts.outputHeight);

  const encoder = new VideoEncoder({
    output: (chunk) => encodedChunks.push(chunk),
    error: (e) => { encoderError = e as Error; },
  });

  const configured = await configureVideoEncoder(encoder, opts.outputWidth, opts.outputHeight, fps);
  if (!configured) {
    try { encoder.close(); } catch { /* ignore */ }
    throw new Error('VideoEncoder: no supported H.264 configuration for this output');
  }

  try {
    await decodeClipFrames({
      file,
      startSec: demuxStartSec,
      durationSec: demuxDurationSec,
      fps,
      frameTimes: { at: (i: number) => opts.frameSrcTimes[i], total: totalFrames },
      signal,
      paused: () => encoder.encodeQueueSize > 24,
      onFrame: (src, i) => {
        if (encoderError) throw encoderError;
        emitFrame(encoder, canvas, opts, logoImg, i, src);
      },
      onProgress: (done) => onProgress(done),
    });

    if (encoderError) throw encoderError;
    await encoder.flush();
    if (encoderError) throw encoderError;
    return chunksToAnnexB(encodedChunks);
  } finally {
    try { if (encoder.state !== 'closed') encoder.close(); } catch { /* ignore */ }
  }
}

// ─── B-roll compositing ───────────────────────────────────────────────────────

/** One planned B-roll insert, mapped to output frame indices. */
export interface BrollSegment {
  file: File;          // downloaded stock clip (mp4)
  startFrame: number;  // inclusive output frame index
  endFrame: number;    // exclusive
  clipDurationSec: number;
}

export interface BrollEncodeOpts extends ClipEncodeSpec {
  sourceFile: File;
  logoImg: ImageBitmap | null;
  brolls: BrollSegment[];
  signal: AbortSignal;
  onProgress: (framesDone: number) => void;
}

const KEN_BURNS_MAX = 1.10; // slow zoom 1.0 → 1.10 across each B-roll span

/**
 * Encode a clip with B-roll inserts (cross-dissolve + Ken Burns). The output
 * timeline is split into alternating SOURCE and B-ROLL segments; each is
 * decoded from its own file (mp4Decoder) and encoded in order into one H.264
 * stream. Source segments keep the clip's PIP/face-centering and overlays;
 * B-roll segments draw the stock footage full-frame with a slow zoom, captions
 * + title still on top. Memory stays bounded — only one segment decodes at a
 * time. A B-roll segment that fails to decode falls back to the source footage
 * for that span.
 *
 * Transitions: at each source↔broll boundary we cross-dissolve over
 * ~200ms by holding the previous segment's last rendered bitmap and
 * compositing it over the new segment's first frames with linear-decay alpha.
 * One ImageBitmap of memory overhead — visually reads as a soft cross-fade.
 */
export async function encodeWithBrollToH264(opts: BrollEncodeOpts): Promise<Uint8Array> {
  if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('WebCodecs/OffscreenCanvas unavailable in this context');
  }
  const { sourceFile, logoImg, brolls, fps, totalFrames, signal, onProgress } = opts;
  const { decodeClipFrames } = await import('./mp4Decoder');
  const { renderFrame } = await import('./canvasRenderer');

  const encodedChunks: EncodedVideoChunk[] = [];
  let encoderError: Error | null = null;
  const canvas = new OffscreenCanvas(opts.outputWidth, opts.outputHeight);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
  const encoder = new VideoEncoder({
    output: (chunk) => encodedChunks.push(chunk),
    error: (e) => { encoderError = e as Error; },
  });
  const configured = await configureVideoEncoder(encoder, opts.outputWidth, opts.outputHeight, fps);
  if (!configured) {
    try { encoder.close(); } catch { /* ignore */ }
    throw new Error('VideoEncoder: no supported H.264 configuration for this output');
  }

  // Build the alternating source/broll timeline over [0, totalFrames).
  type Seg = { kind: 'source' | 'broll'; a: number; b: number; broll?: BrollSegment };
  const segs: Seg[] = [];
  let cursor = 0;
  const sorted = brolls
    .map((s) => ({
      ...s,
      startFrame: Math.max(0, Math.min(s.startFrame, totalFrames)),
      endFrame: Math.max(0, Math.min(s.endFrame, totalFrames)),
    }))
    .filter((s) => s.endFrame > s.startFrame)
    .sort((x, y) => x.startFrame - y.startFrame);
  for (const s of sorted) {
    if (s.startFrame < cursor) continue; // skip overlaps defensively
    if (s.startFrame > cursor) segs.push({ kind: 'source', a: cursor, b: s.startFrame });
    segs.push({ kind: 'broll', a: s.startFrame, b: s.endFrame, broll: s });
    cursor = s.endFrame;
  }
  if (cursor < totalFrames) segs.push({ kind: 'source', a: cursor, b: totalFrames });

  let framesDone = 0;

  // Cross-dissolve state: holds the last rendered bitmap of the previous
  // segment, overlaid on the next segment's first DISSOLVE_FRAMES frames with
  // alpha decaying linearly from 1 → 0.
  const DISSOLVE_FRAMES = Math.max(2, Math.min(6, Math.round(fps * 0.2)));
  let tailBitmap: ImageBitmap | null = null;

  /**
   * After renderFrame has drawn the new segment's content into the canvas,
   * blend the held tailBitmap on top (for fade-in), transfer to a bitmap,
   * encode, and optionally keep the bitmap as the new tail.
   */
  const finalizeFrame = (
    gi: number,
    fromStart: number,
    isLastInSeg: boolean,
    wantNewTail: boolean,
  ) => {
    if (tailBitmap && fromStart < DISSOLVE_FRAMES) {
      const alpha = 1 - (fromStart + 1) / (DISSOLVE_FRAMES + 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(tailBitmap, 0, 0, opts.outputWidth, opts.outputHeight);
      ctx.restore();
    }
    const bitmap = canvas.transferToImageBitmap();
    const vf = new VideoFrame(bitmap, {
      timestamp: Math.round((gi / fps) * 1_000_000),
      duration: Math.round((1 / fps) * 1_000_000),
    });
    encoder.encode(vf, { keyFrame: gi % Math.round(fps * 2) === 0 });
    vf.close();
    if (isLastInSeg && wantNewTail) {
      if (tailBitmap) tailBitmap.close();
      tailBitmap = bitmap; // keep alive for the next segment's fade-in
    } else {
      bitmap.close();
    }
  };

  const emitSourceRange = async (a: number, b: number, wantTailAtEnd: boolean) => {
    const count = b - a;
    if (count <= 0) return;
    const startSec = opts.frameSrcTimes[a];
    const endSec = opts.frameSrcTimes[b - 1];
    await decodeClipFrames({
      file: sourceFile,
      startSec,
      durationSec: Math.max(endSec - startSec + 1 / fps, 1 / fps),
      fps,
      frameTimes: { at: (j: number) => opts.frameSrcTimes[a + j], total: count },
      signal,
      paused: () => encoder.encodeQueueSize > 24,
      onFrame: (frame, j) => {
        if (encoderError) throw encoderError;
        const gi = a + j;
        renderFrame({
          video: frame, canvas,
          currentTimeSec: opts.frameSrcTimes[gi],
          clipStartSec: opts.clip.start_time,
          clip: opts.clip, styleConfig: opts.styleConfig,
          logoImg, logoConfig: opts.logoConfig ?? null,
          pipConfig: opts.pipConfig ?? null, layoutType: opts.layoutType,
          pipStartSec: opts.pipStartSec, pipEndSec: opts.pipEndSec,
          width: opts.outputWidth, height: opts.outputHeight,
          faceCenter: opts.faceCenters?.[gi] ?? null,
        });
        finalizeFrame(gi, j, j === count - 1, wantTailAtEnd);
        framesDone++;
        onProgress(framesDone);
      },
    });
  };

  try {
    for (let si = 0; si < segs.length; si++) {
      const seg = segs[si];
      const next = segs[si + 1];
      // Save a tail bitmap only when the next segment is of a different kind —
      // i.e. there's a real source/broll boundary worth dissolving across.
      const wantTail = !!next && next.kind !== seg.kind;

      signal.throwIfAborted();
      if (encoderError) throw encoderError;
      if (seg.b - seg.a <= 0) continue;

      if (seg.kind === 'source') {
        await emitSourceRange(seg.a, seg.b, wantTail);
        continue;
      }

      const broll = seg.broll!;
      const count = seg.b - seg.a;
      const dur = Math.max(broll.clipDurationSec, 0.2);
      try {
        await decodeClipFrames({
          file: broll.file,
          startSec: 0,
          durationSec: Math.min(count / fps + 1 / fps, dur),
          fps,
          // No looping: clamp to the clip's last frame if the span outlasts it.
          frameTimes: { at: (j: number) => Math.min(j / fps, Math.max(dur - 1 / fps, 0)), total: count },
          signal,
          paused: () => encoder.encodeQueueSize > 24,
          onFrame: (frame, j) => {
            if (encoderError) throw encoderError;
            const gi = seg.a + j;
            const z = 1 + (KEN_BURNS_MAX - 1) * (count > 1 ? j / (count - 1) : 0);
            renderFrame({
              video: frame, canvas,
              currentTimeSec: opts.frameSrcTimes[gi],
              clipStartSec: opts.clip.start_time,
              clip: opts.clip, styleConfig: opts.styleConfig,
              logoImg, logoConfig: opts.logoConfig ?? null,
              pipConfig: null, layoutType: 'standard',
              width: opts.outputWidth, height: opts.outputHeight,
              faceCenter: null, bgZoom: z,
            });
            finalizeFrame(gi, j, j === count - 1, wantTail);
            framesDone++;
            onProgress(framesDone);
          },
        });
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        if (encoderError) throw encoderError;
        // Stock clip wouldn't decode — keep the speaker on screen for this span.
        console.warn('B-roll segment failed to decode; using source footage instead:', err);
        await emitSourceRange(seg.a, seg.b, wantTail);
      }
    }
  } finally {
    if (tailBitmap) { try { tailBitmap.close(); } catch { /* already closed */ } tailBitmap = null; }
  }

  if (encoderError) throw encoderError;
  await encoder.flush();
  if (encoderError) throw encoderError;
  try { if (encoder.state !== 'closed') encoder.close(); } catch { /* ignore */ }
  return chunksToAnnexB(encodedChunks);
}
