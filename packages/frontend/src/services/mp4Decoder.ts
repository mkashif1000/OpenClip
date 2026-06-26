/**
 * Frame-accurate clip decoding: mp4box.js demux + WebCodecs VideoDecoder.
 *
 * Replaces realtime playback capture for exports. Demuxes only the samples
 * around [startSec, startSec + durationSec] (chunked reads — never loads the
 * whole file), decodes them with VideoDecoder, and emits exactly
 * ceil(duration * fps) frames on a constant-fps grid using sample-and-hold:
 * each output frame is the source frame visible at that timestamp.
 *
 * Because nothing here depends on realtime playback, output quality and frame
 * timing are identical on any hardware — only the wall-clock speed varies.
 *
 * Throws if the file isn't a parseable MP4 or the codec can't be decoded;
 * callers fall back to <video> seek capture.
 */

import { createFile, DataStream, MP4BoxBuffer, type Sample } from 'mp4box';

export interface DecodeClipJob {
  file: File;
  startSec: number;
  durationSec: number;
  fps: number;
  signal: AbortSignal;
  /** Receives a borrowed VideoFrame per grid index — must not close/retain it. */
  onFrame: (source: VideoFrame, index: number) => void;
  onProgress?: (framesDone: number) => void;
  /** Consumer backpressure (e.g. encoder queue depth) — pauses demuxing while true. */
  paused?: () => boolean;
  /**
   * Optional output→source time mapping (e.g. silence cuts). `at(i)` must be
   * monotonically non-decreasing in i and stay within [startSec, startSec +
   * durationSec]. Defaults to the uniform grid startSec + i/fps.
   */
  frameTimes?: { at(i: number): number; total: number };
}

const CHUNK = 4 * 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function decodeClipFrames(job: DecodeClipJob): Promise<number> {
  const { file, startSec, durationSec, fps, signal, onFrame, onProgress, paused, frameTimes } = job;
  const totalFrames = frameTimes?.total ?? Math.ceil(durationSec * fps);
  const endSec = startSec + durationSec;
  const gridTime = frameTimes ? (i: number) => frameTimes.at(i) : (i: number) => startSec + i / fps;

  const mp4 = createFile();
  let parseError: Error | null = null;
  mp4.onError = (module: string, message: string) => {
    parseError = new Error(`mp4box ${module}: ${message}`);
  };

  // ── Phase 1: feed until the moov box is parsed ────────────────────────────
  // appendBuffer returns the next byte offset mp4box wants, letting us jump
  // over mdat when moov sits at the end of the file.
  let pos = 0;
  let ready = false;
  mp4.onReady = () => { ready = true; };
  while (!ready && !parseError && pos < file.size) {
    signal.throwIfAborted();
    const end = Math.min(pos + CHUNK, file.size);
    const ab = await file.slice(pos, end).arrayBuffer();
    const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(ab, pos));
    pos = typeof next === 'number' && next > end ? next : end;
  }
  if (parseError) throw parseError;
  if (!ready) throw new Error('mp4box: no moov box found (not an MP4?)');

  const info = mp4.getInfo();
  const track = info.videoTracks?.[0];
  if (!track) throw new Error('mp4box: no video track');

  const codec = track.codec;
  const description = avcDescription(mp4, track.id);
  if (/^(avc1|avc3|hvc1|hev1)/.test(codec) && !description) {
    throw new Error(`mp4box: missing decoder description for ${codec}`);
  }
  const config: VideoDecoderConfig = {
    codec,
    ...(description ? { description } : {}),
    hardwareAcceleration: 'no-preference',
  };
  const support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) throw new Error(`VideoDecoder: unsupported codec ${codec}`);

  // ── Decoder with grid emission (sample-and-hold) ──────────────────────────
  let prev: VideoFrame | null = null;
  let nextIdx = 0;
  let decodeError: Error | null = null;

  const decoder = new VideoDecoder({
    output: (frame) => {
      if (decodeError || signal.aborted || nextIdx >= totalFrames) {
        frame.close();
        return;
      }
      try {
        const ft = frame.timestamp / 1e6;
        if (prev) {
          while (nextIdx < totalFrames && gridTime(nextIdx) < ft - 1e-4) {
            onFrame(prev, nextIdx);
            nextIdx++;
          }
          prev.close();
        }
        prev = frame;
        onProgress?.(nextIdx);
      } catch (e) {
        decodeError = e instanceof Error ? e : new Error(String(e));
        try { frame.close(); } catch { /* already closed */ }
      }
    },
    error: (e) => { decodeError = e; },
  });
  decoder.configure(support.config ?? config);

  // ── Phase 2: extract + decode samples for the clip range ─────────────────
  let doneFeeding = false;
  let seenKey = false;
  mp4.onSamples = (_id: number, _user: unknown, samples: Array<Sample>) => {
    let lastNumber = -1;
    for (const s of samples) {
      lastNumber = s.number;
      if (!s.data) continue;
      const t = s.cts / s.timescale;
      if (t > endSec + 0.5) { doneFeeding = true; break; }
      // VideoDecoder requires the first chunk to be a keyframe.
      if (!seenKey) {
        if (!s.is_sync) continue;
        seenKey = true;
      }
      decoder.decode(new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: Math.round(t * 1e6),
        duration: Math.round((s.duration / s.timescale) * 1e6),
        data: s.data,
      }));
    }
    // Let mp4box free retained sample memory (matters on multi-GB sources).
    if (lastNumber >= 0) {
      try { mp4.releaseUsedSamples(track.id, lastNumber); } catch { /* non-fatal */ }
    }
  };

  try {
    mp4.setExtractionOptions(track.id, null, { nbSamples: 64 });
    // Position extraction at the keyframe at/before the clip start, and get
    // the byte offset to resume reading from.
    const sk = mp4.seek(Math.max(startSec - 0.05, 0), true);
    mp4.start();
    pos = Math.min(Math.max(sk?.offset ?? 0, 0), file.size);

    while (!doneFeeding && !decodeError && !parseError && pos < file.size) {
      signal.throwIfAborted();
      while ((decoder.decodeQueueSize > 24 || paused?.()) && !decodeError) {
        await sleep(2);
        signal.throwIfAborted();
      }
      const end = Math.min(pos + CHUNK, file.size);
      const ab = await file.slice(pos, end).arrayBuffer();
      const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(ab, pos));
      pos = typeof next === 'number' && next > end ? next : end;
    }
    if (parseError) throw parseError;
    mp4.flush();
    if (decodeError) throw decodeError;
    if (decoder.state === 'configured') await decoder.flush();
    if (decodeError) throw decodeError;

    // Pad trailing grid frames covered by the final decoded frame.
    while (nextIdx < totalFrames && prev) {
      onFrame(prev, nextIdx);
      nextIdx++;
    }
    onProgress?.(nextIdx);
    if (nextIdx < totalFrames) {
      throw new Error(`mp4 decode produced ${nextIdx}/${totalFrames} frames`);
    }
    return nextIdx;
  } finally {
    try { prev?.close(); } catch { /* already closed */ }
    try { if (decoder.state !== 'closed') decoder.close(); } catch { /* ignore */ }
    try { mp4.stop(); } catch { /* ignore */ }
  }
}

/**
 * Serialize the avcC/hvcC box (minus its 8-byte header) as the
 * VideoDecoderConfig.description, per the WebCodecs AVC/HEVC registry.
 */
function avcDescription(mp4: ReturnType<typeof createFile>, trackId: number): Uint8Array | undefined {
  try {
    const trak = mp4.getTrackById(trackId) as unknown as {
      mdia?: { minf?: { stbl?: { stsd?: { entries?: Array<Record<string, unknown>> } } } };
    };
    const entries = trak?.mdia?.minf?.stbl?.stsd?.entries ?? [];
    for (const entry of entries) {
      const box = (entry.avcC ?? entry.hvcC) as
        | { write: (s: unknown) => void; size: number }
        | undefined;
      if (box) {
        const stream = new (DataStream as unknown as new () => { buffer: ArrayBuffer })();
        box.write(stream);
        return new Uint8Array(stream.buffer, 8, box.size - 8);
      }
    }
  } catch { /* fall through to undefined */ }
  return undefined;
}
