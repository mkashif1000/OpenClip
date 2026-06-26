/**
 * Render worker — runs the heavy frame pipeline (mp4 demux + decode → canvas
 * overlays → H.264 encode) off the main thread so long renders no longer jank
 * the UI. It returns a raw H.264 Annex B stream; the main thread extracts audio
 * and muxes the final MP4 (so ffmpeg.wasm only ever loads once, on the main
 * thread).
 *
 * Everything here is worker-safe: VideoDecoder/VideoEncoder, OffscreenCanvas,
 * mp4box and OPFS File slicing all work in a Worker context. The seeking
 * <video> fallback (for non-MP4 sources) and the ffmpeg-only fallback stay on
 * the main thread, since HTMLVideoElement isn't available here.
 */

import { encodeMp4ClipToH264 } from './encodeCore';
import type { FaceCenter } from './encodeCore';
import type { ClipData, StyleConfig, PIPConfig } from '@/types';
import type { LayoutType } from './canvasRenderer';
import { ensureFontsLoaded } from './fontLoader';

export interface RenderWorkerRequest {
  type: 'render';
  file: File;
  logoFile: File | null;
  clip: ClipData;
  styleConfig: StyleConfig;
  logoConfig: { x: number; y: number; size: number; opacity: number } | null;
  pipConfig: PIPConfig | null;
  layoutType: LayoutType;
  pipStartSec?: number;
  pipEndSec?: number;
  outputWidth: number;
  outputHeight: number;
  fps: number;
  totalFrames: number;
  frameSrcTimes: Float64Array;
  faceCenters: (FaceCenter | null)[] | null;
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }> | null;
  demuxStartSec: number;
  demuxDurationSec: number;
}

export type RenderWorkerResponse =
  | { type: 'progress'; framesDone: number }
  | { type: 'done'; h264: ArrayBuffer }
  | { type: 'error'; name: string; message: string };

// Typed minimally to avoid pulling in the WebWorker lib (which conflicts with
// the DOM lib this project compiles against). The casts are safe — these APIs
// all exist in a DedicatedWorkerGlobalScope.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let controller: AbortController | null = null;

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data as { type?: string };

  if (msg?.type === 'abort') {
    controller?.abort();
    return;
  }

  if (msg?.type !== 'render') return;

  const req = msg as unknown as RenderWorkerRequest;
  controller = new AbortController();

  let logoImg: ImageBitmap | null = null;
  try {
    if (req.logoFile) {
      try {
        logoImg = await createImageBitmap(req.logoFile);
      } catch {
        logoImg = null; // non-fatal — render without the logo
      }
    }

    // Load the chosen caption/title fonts into the worker's FontFaceSet so the
    // OffscreenCanvas can actually draw them (the document's <link> doesn't
    // reach here). Best-effort — falls back to a system font on failure.
    await ensureFontsLoaded([
      req.styleConfig?.subtitle?.font_name,
      req.styleConfig?.title?.font_name,
      req.clip?.edits?.titleFont,
    ]);

    const h264 = await encodeMp4ClipToH264({
      file: req.file,
      logoImg,
      clip: req.clip,
      styleConfig: req.styleConfig,
      logoConfig: req.logoConfig,
      pipConfig: req.pipConfig,
      layoutType: req.layoutType,
      pipStartSec: req.pipStartSec,
      pipEndSec: req.pipEndSec,
      outputWidth: req.outputWidth,
      outputHeight: req.outputHeight,
      fps: req.fps,
      totalFrames: req.totalFrames,
      frameSrcTimes: req.frameSrcTimes,
      faceCenters: req.faceCenters,
      regionCrops: req.regionCrops ?? null,
      demuxStartSec: req.demuxStartSec,
      demuxDurationSec: req.demuxDurationSec,
      signal: controller.signal,
      onProgress: (framesDone) => {
        const m: RenderWorkerResponse = { type: 'progress', framesDone };
        ctx.postMessage(m);
      },
    });

    // Transfer the underlying ArrayBuffer back zero-copy.
    const out = (h264.byteOffset === 0 && h264.byteLength === h264.buffer.byteLength
      ? h264.buffer
      : h264.slice().buffer) as ArrayBuffer;
    const done: RenderWorkerResponse = { type: 'done', h264: out };
    ctx.postMessage(done, [out]);
  } catch (err) {
    const e2 = err as Error;
    const m: RenderWorkerResponse = {
      type: 'error',
      name: e2?.name ?? 'Error',
      message: String(e2?.message ?? err),
    };
    ctx.postMessage(m);
  } finally {
    logoImg?.close();
    controller = null;
  }
};
