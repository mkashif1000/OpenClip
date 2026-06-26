/**
 * ffmpeg.wasm service — singleton wrapper around @ffmpeg/ffmpeg.
 * Handles: video probing, segment extraction, audio extraction, muxing.
 * Uses multi-threaded core (requires COOP/COEP headers).
 */

import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { opfsReadBytes, opfsWriteBytes, opfsReadFile } from './opfs';

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  hasAudio: boolean;
}

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Lazy-load the ffmpeg.wasm core.
 * Safe to call multiple times — resolves immediately if already loaded.
 */
export async function ensureFFmpegLoaded(
  onProgress?: (ratio: number) => void,
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  if (!loadPromise) {
    loadPromise = (async () => {
      const ff = new FFmpeg();

      if (onProgress) {
        ff.on('progress', ({ progress }) => onProgress(progress));
      }

      // Use CDN-hosted WASM for simplicity. The toBlobURL helper fetches
      // with credentials and re-serves from a blob: URL to satisfy COOP/COEP.
      const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
      await ff.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });

      ffmpegInstance = ff;
    })();
  }

  await loadPromise;
  return ffmpegInstance!;
}

/**
 * Probe a video file stored in OPFS.
 * Returns duration, dimensions, fps, codec.
 */
export async function probeVideo(fileId: string): Promise<VideoInfo> {
  const ff = await ensureFFmpegLoaded();

  const bytes = await opfsReadBytes(fileId);
  await ff.writeFile('probe_input.mp4', bytes);

  let stderrOutput = '';
  ff.on('log', ({ message }) => {
    stderrOutput += message + '\n';
  });

  // ffmpeg -i triggers an error (no output) but prints stream info to stderr
  try {
    await ff.exec(['-i', 'probe_input.mp4']);
  } catch {
    // Expected — ffmpeg errors when no output is given
  }

  await ff.deleteFile('probe_input.mp4').catch(() => {});

  return parseFFmpegProbeOutput(stderrOutput);
}

/**
 * Probe a video from a File object (before it's stored in OPFS).
 * Used during the upload flow for immediate metadata extraction.
 */
export async function probeVideoFile(file: File): Promise<VideoInfo> {
  const ff = await ensureFFmpegLoaded();

  const bytes = new Uint8Array(await file.arrayBuffer());
  await ff.writeFile('probe_input.mp4', bytes);

  let stderrOutput = '';
  const logHandler = ({ message }: { message: string }) => {
    stderrOutput += message + '\n';
  };
  ff.on('log', logHandler);

  try {
    await ff.exec(['-i', 'probe_input.mp4']);
  } catch {
    // Expected
  }

  ff.off('log', logHandler);
  await ff.deleteFile('probe_input.mp4').catch(() => {});

  return parseFFmpegProbeOutput(stderrOutput);
}

function parseFFmpegProbeOutput(stderr: string): VideoInfo {
  // Duration: 00:04:32.45
  const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  let duration = 0;
  if (durationMatch) {
    duration =
      parseInt(durationMatch[1]) * 3600 +
      parseInt(durationMatch[2]) * 60 +
      parseFloat(durationMatch[3]);
  }

  // Locate the first Video: stream line. The fields after Video: are
  // comma-separated, but commas can appear inside parentheses too — e.g.
  // `yuv420p(tv, bt709)`. The old single-regex parse insisted on
  // comma-free fields and silently fell back to 0x0 @ 30fps on any modern file,
  // which made exports render at half the source frame rate.
  let codec = '';
  let width = 0;
  let height = 0;
  let fps = 30;

  const videoLineMatch = stderr.match(/Video:\s*([^\n]+)/);
  if (videoLineMatch) {
    const line = videoLineMatch[1];
    // Codec is the first whitespace-delimited token on the line.
    const codecMatch = line.match(/^(\w+)/);
    if (codecMatch) codec = codecMatch[1];

    // Dimensions: first WxH on the line (ignores SAR 1:1 etc.).
    const dimMatch = line.match(/(\d{2,5})x(\d{2,5})/);
    if (dimMatch) {
      width = parseInt(dimMatch[1]);
      height = parseInt(dimMatch[2]);
    }

    // Frame rate: prefer `fps`, fall back to `tbr`. Both can be a decimal or
    // a fraction (`29.97 fps`, `30000/1001 tbr`).
    const fpsMatch = line.match(/([\d.]+(?:\/[\d.]+)?)\s*fps/)
      ?? line.match(/([\d.]+(?:\/[\d.]+)?)\s*tbr/);
    if (fpsMatch) {
      const fpsStr = fpsMatch[1];
      if (fpsStr.includes('/')) {
        const [num, den] = fpsStr.split('/').map(Number);
        fps = den > 0 ? num / den : 30;
      } else {
        fps = parseFloat(fpsStr) || 30;
      }
    }
  }

  const hasAudio = /Audio:/.test(stderr);

  return { duration, width, height, fps: Math.round(fps * 100) / 100, codec, hasAudio };
}

/**
 * Extract a time-range segment from a video in OPFS using stream-copy (fast).
 * Returns the OPFS file ID of the new segment.
 */
export async function extractSegment(
  fileId: string,
  startSec: number,
  durationSec: number,
  outputId: string,
): Promise<string> {
  const ff = await ensureFFmpegLoaded();

  const bytes = await opfsReadBytes(fileId);
  await ff.writeFile('seg_input.mp4', bytes);

  await ff.exec([
    '-y',
    '-ss', String(startSec),
    '-i', 'seg_input.mp4',
    '-t', String(durationSec),
    '-c', 'copy',
    '-movflags', '+faststart',
    'seg_output.mp4',
  ]);

  const result = await ff.readFile('seg_output.mp4') as Uint8Array;
  await opfsWriteBytes(outputId, result);

  await ff.deleteFile('seg_input.mp4').catch(() => {});
  await ff.deleteFile('seg_output.mp4').catch(() => {});

  return outputId;
}

/** Optional background music to mix into the rendered audio. */
export interface MusicMix {
  fileId: string;    // OPFS id of the music file (mp3/wav/m4a etc.)
  volume: number;    // 0..1 — volume multiplier applied to the music track
}

/** Optional pre-rendered stereo f32le SFX track at a known sample rate. */
export interface SfxTrack {
  pcm: Uint8Array;   // interleaved stereo float32 little-endian
  sampleRate: number;
}

/**
 * Extract only the audio track from a clip range, optionally mixing in a
 * looping background music track and/or a pre-rendered SFX PCM track.
 * Returns raw AAC bytes suitable for muxing.
 */
export async function extractAudio(
  fileId: string,
  startSec: number,
  durationSec: number,
  music?: MusicMix | null,
  sfx?: SfxTrack | null,
): Promise<Uint8Array> {
  if (music || sfx) {
    try {
      return await extractAudioWithExtras(fileId, startSec, durationSec, music ?? null, sfx ?? null);
    } catch (err) {
      console.warn('Audio mix (music/sfx) failed; falling back to source-only audio:', err);
      // fall through to source-only extraction
    }
  }

  const ff = await ensureFFmpegLoaded();
  const OUT = 'audio_output.aac';
  const args = (input: string) => [
    '-y',
    '-ss', String(startSec),
    '-i', input,
    '-t', String(durationSec),
    '-vn',              // no video
    '-acodec', 'aac',
    '-b:a', '128k',
    OUT,
  ];

  // Fast path: mount the OPFS file via WORKERFS so ffmpeg seeks and reads only
  // the needed bytes, instead of copying the whole (multi-GB) file into memory
  // for every clip (which spikes memory and is slow).
  try {
    const file = await opfsReadFile(fileId);
    const dir = '/mnt_src';
    try { await ff.createDir(dir); } catch { /* may already exist */ }
    await ff.mount(FFFSType.WORKERFS, { blobs: [{ name: 'src', data: file }] }, dir);
    try {
      await ff.exec(args(`${dir}/src`));
      const result = await ff.readFile(OUT) as Uint8Array;
      await ff.deleteFile(OUT).catch(() => {});
      return result;
    } finally {
      await ff.unmount(dir).catch(() => {});
    }
  } catch (err) {
    console.warn('WORKERFS audio extract failed; using in-memory fallback:', err);
  }

  // Fallback: load the whole file into memory (works everywhere, heavier).
  const bytes = await opfsReadBytes(fileId);
  await ff.writeFile('audio_input.mp4', bytes);
  await ff.exec(args('audio_input.mp4'));
  const result = await ff.readFile(OUT) as Uint8Array;
  await ff.deleteFile('audio_input.mp4').catch(() => {});
  await ff.deleteFile(OUT).catch(() => {});
  return result;
}

/**
 * Mix source-clip audio with optional looping background music and/or a
 * pre-rendered SFX PCM track in one ffmpeg pass. Source plays at full volume;
 * music is scaled by `music.volume`; SFX comes in at unity (already shaped).
 * Music loops forever (-stream_loop -1); amix's `duration=first` ends when
 * source ends, and `normalize=0` keeps source at its natural level.
 */
async function extractAudioWithExtras(
  fileId: string,
  startSec: number,
  durationSec: number,
  music: MusicMix | null,
  sfx: SfxTrack | null,
): Promise<Uint8Array> {
  const ff = await ensureFFmpegLoaded();
  const OUT = 'audio_mix_out.aac';
  const SFX_FILE = 'sfx_in.pcm';

  // Build a 0-based input index map so the filter graph references the right
  // streams regardless of which extras are enabled.
  const inputs: string[] = [];
  const filterParts: string[] = [];
  let nextIdx = 0;
  const srcIdx = nextIdx++;
  inputs.push('source-placeholder'); // replaced with real path below

  let musIdx = -1;
  if (music) {
    musIdx = nextIdx++;
    inputs.push('music-placeholder');
    const vol = Math.max(0, Math.min(1, music.volume)).toFixed(3);
    filterParts.push(`[${musIdx}:a]volume=${vol}[m]`);
  }

  let sfxIdx = -1;
  if (sfx) {
    sfxIdx = nextIdx++;
    inputs.push('sfx-placeholder');
  }

  // amix labels: source unchanged, music as [m], sfx as [${sfxIdx}:a].
  const mixLabels = [`[${srcIdx}:a]`];
  if (musIdx >= 0) mixLabels.push('[m]');
  if (sfxIdx >= 0) mixLabels.push(`[${sfxIdx}:a]`);
  filterParts.push(
    `${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0[a]`,
  );

  const srcFile = await opfsReadFile(fileId);
  const musicFile = music ? await opfsReadFile(music.fileId) : null;
  const srcDir = '/mnt_audsrc';
  const musDir = '/mnt_audmus';
  try { await ff.createDir(srcDir); } catch { /* exists */ }
  await ff.mount(FFFSType.WORKERFS, { blobs: [{ name: 'src', data: srcFile }] }, srcDir);
  if (musicFile) {
    try { await ff.createDir(musDir); } catch { /* exists */ }
    await ff.mount(FFFSType.WORKERFS, { blobs: [{ name: 'mus', data: musicFile }] }, musDir);
  }
  if (sfx) await ff.writeFile(SFX_FILE, sfx.pcm);

  try {
    const args: string[] = ['-y', '-ss', String(startSec), '-i', `${srcDir}/src`];
    if (musicFile) args.push('-stream_loop', '-1', '-i', `${musDir}/mus`);
    if (sfx) args.push('-f', 'f32le', '-ar', String(sfx.sampleRate), '-ac', '2', '-i', SFX_FILE);
    args.push(
      '-t', String(durationSec),
      '-filter_complex', filterParts.join(';'),
      '-map', '[a]',
      '-acodec', 'aac', '-b:a', '128k',
      OUT,
    );
    await ff.exec(args);
    const result = await ff.readFile(OUT) as Uint8Array;
    await ff.deleteFile(OUT).catch(() => {});
    return result;
  } finally {
    await ff.unmount(srcDir).catch(() => {});
    if (musicFile) await ff.unmount(musDir).catch(() => {});
    if (sfx) await ff.deleteFile(SFX_FILE).catch(() => {});
  }
}

/**
 * Extract raw PCM for a time range. Mounts the source via WORKERFS (no full
 * file copy); falls back to in-memory on failure.
 */
async function extractPcm(
  fileId: string,
  startSec: number,
  durationSec: number,
  sampleRate: number,
  channels: number,
): Promise<Uint8Array> {
  const ff = await ensureFFmpegLoaded();
  const OUT = 'pcm_out.raw';
  const args = (input: string) => [
    '-y',
    '-ss', String(startSec),
    '-i', input,
    '-t', String(durationSec),
    '-vn',
    '-ac', String(channels),
    '-ar', String(sampleRate),
    '-f', 'f32le',
    OUT,
  ];

  try {
    const file = await opfsReadFile(fileId);
    const dir = '/mnt_pcm';
    try { await ff.createDir(dir); } catch { /* exists */ }
    await ff.mount(FFFSType.WORKERFS, { blobs: [{ name: 'src', data: file }] }, dir);
    try {
      await ff.exec(args(`${dir}/src`));
      const result = await ff.readFile(OUT) as Uint8Array;
      await ff.deleteFile(OUT).catch(() => {});
      return result;
    } finally {
      await ff.unmount(dir).catch(() => {});
    }
  } catch (err) {
    console.warn('WORKERFS PCM extract failed; using in-memory fallback:', err);
  }

  const bytes = await opfsReadBytes(fileId);
  await ff.writeFile('pcm_input', bytes);
  await ff.exec(args('pcm_input'));
  const result = await ff.readFile(OUT) as Uint8Array;
  await ff.deleteFile('pcm_input').catch(() => {});
  await ff.deleteFile(OUT).catch(() => {});
  return result;
}

/**
 * Compressed mono 16 kHz AAC/m4a for a time range — small uploads for
 * cloud transcription APIs (Whisper downsamples to 16 kHz anyway).
 */
export async function extractAudioForUpload(
  fileId: string,
  durationSec: number,
): Promise<Blob> {
  const ff = await ensureFFmpegLoaded();
  const COPY = 'aud_copy.m4a';
  const ENC = 'aud_enc.m4a';

  const run = async (input: string): Promise<Blob> => {
    // Fast path: copy the first audio stream as-is — no decode/re-encode, so
    // it's near-instant and lossless. Works whenever the source audio codec is
    // MP4-compatible (AAC etc. — the common case).
    try {
      await ff.exec(['-y', '-i', input, '-map', '0:a:0', '-c:a', 'copy', '-movflags', '+faststart', COPY]);
      const data = await ff.readFile(COPY) as Uint8Array;
      await ff.deleteFile(COPY).catch(() => {});
      if (data.length > 0) return new Blob([data.slice()], { type: 'audio/mp4' });
    } catch {
      // Codec can't be copied into MP4 — fall through to a compact re-encode.
    }
    // Fallback: small speech-grade 16 kHz mono AAC.
    await ff.exec([
      '-y', '-i', input, '-t', String(durationSec),
      '-map', '0:a:0', '-ac', '1', '-ar', '16000',
      '-c:a', 'aac', '-b:a', '40k', '-movflags', '+faststart', ENC,
    ]);
    const data = await ff.readFile(ENC) as Uint8Array;
    await ff.deleteFile(ENC).catch(() => {});
    return new Blob([data.slice()], { type: 'audio/mp4' });
  };

  // Mount the source via WORKERFS so ffmpeg reads it lazily (no full copy into
  // memory), then run the copy/encode there.
  try {
    const file = await opfsReadFile(fileId);
    const dir = '/mnt_up';
    try { await ff.createDir(dir); } catch { /* exists */ }
    await ff.mount(FFFSType.WORKERFS, { blobs: [{ name: 'src', data: file }] }, dir);
    try {
      return await run(`${dir}/src`);
    } finally {
      await ff.unmount(dir).catch(() => {});
    }
  } catch (err) {
    console.warn('WORKERFS audio extract failed; in-memory fallback:', err);
  }
  const bytes = await opfsReadBytes(fileId);
  await ff.writeFile('up_input', bytes);
  try {
    return await run('up_input');
  } finally {
    await ff.deleteFile('up_input').catch(() => {});
  }
}

/**
 * Mono float32 PCM at the given sample rate — the input Whisper expects.
 */
export async function extractPcmF32Mono(
  fileId: string,
  startSec: number,
  durationSec: number,
  sampleRate = 16000,
): Promise<Float32Array> {
  const bytes = await extractPcm(fileId, startSec, durationSec, sampleRate, 1);
  // Copy to guarantee 4-byte alignment for the Float32Array view.
  const aligned = bytes.slice();
  return new Float32Array(aligned.buffer, 0, Math.floor(aligned.byteLength / 4));
}

/**
 * Extract several source segments, concatenate them, and encode one AAC
 * track — the audio counterpart of rendering with silence cuts applied.
 */
export async function extractConcatAudioAac(
  fileId: string,
  segments: Array<{ start: number; end: number }>,
  music?: MusicMix | null,
  sfx?: SfxTrack | null,
): Promise<Uint8Array> {
  const SR = 44100;
  const parts: Uint8Array[] = [];
  let total = 0;
  for (const seg of segments) {
    const dur = Math.max(seg.end - seg.start, 0.01);
    const pcm = await extractPcm(fileId, seg.start, dur, SR, 2);
    parts.push(pcm);
    total += pcm.length;
  }
  const joined = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { joined.set(p, off); off += p.length; }

  const ff = await ensureFFmpegLoaded();
  await ff.writeFile('concat.pcm', joined);

  // Mix music and/or SFX into the final encode if requested. Music is mounted
  // via WORKERFS and looped; SFX is a pre-rendered PCM track written to MEMFS;
  // the source PCM concat is the f32le input. Falls back to source-only on
  // any failure so a bad extra never breaks the render.
  if (music || sfx) {
    const musDir = '/mnt_concatmus';
    const SFX_FILE = 'concat_sfx.pcm';
    let mounted = false;
    try {
      const inputs: string[] = ['-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'concat.pcm'];
      let nextIdx = 1;
      const filterParts: string[] = [];
      const mixLabels = ['[0:a]'];

      if (music) {
        const musicFile = await opfsReadFile(music.fileId);
        try { await ff.createDir(musDir); } catch { /* exists */ }
        await ff.mount(FFFSType.WORKERFS, { blobs: [{ name: 'mus', data: musicFile }] }, musDir);
        mounted = true;
        inputs.push('-stream_loop', '-1', '-i', `${musDir}/mus`);
        const vol = Math.max(0, Math.min(1, music.volume)).toFixed(3);
        filterParts.push(`[${nextIdx}:a]volume=${vol}[m]`);
        mixLabels.push('[m]');
        nextIdx++;
      }
      if (sfx) {
        await ff.writeFile(SFX_FILE, sfx.pcm);
        inputs.push('-f', 'f32le', '-ar', String(sfx.sampleRate), '-ac', '2', '-i', SFX_FILE);
        mixLabels.push(`[${nextIdx}:a]`);
        nextIdx++;
      }
      filterParts.push(
        `${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0[a]`,
      );

      try {
        await ff.exec([
          '-y',
          ...inputs,
          '-filter_complex', filterParts.join(';'),
          '-map', '[a]',
          '-acodec', 'aac', '-b:a', '128k',
          'concat_out.aac',
        ]);
        const result = await ff.readFile('concat_out.aac') as Uint8Array;
        await ff.deleteFile('concat.pcm').catch(() => {});
        await ff.deleteFile('concat_out.aac').catch(() => {});
        if (sfx) await ff.deleteFile(SFX_FILE).catch(() => {});
        return result;
      } finally {
        if (mounted) await ff.unmount(musDir).catch(() => {});
      }
    } catch (err) {
      console.warn('Mix (music/sfx) on concat failed; using source-only audio:', err);
      if (mounted) await ff.unmount(musDir).catch(() => {});
      // fall through to source-only encode below
    }
  }

  await ff.exec([
    '-y',
    '-f', 'f32le', '-ar', String(SR), '-ac', '2',
    '-i', 'concat.pcm',
    '-acodec', 'aac', '-b:a', '128k',
    'concat_out.aac',
  ]);
  const result = await ff.readFile('concat_out.aac') as Uint8Array;
  await ff.deleteFile('concat.pcm').catch(() => {});
  await ff.deleteFile('concat_out.aac').catch(() => {});
  return result;
}

/**
 * Mux an H.264 bitstream + AAC audio into a final MP4 container.
 * Returns a Blob ready for download.
 */
export async function muxVideoAudio(
  videoH264: Uint8Array,
  audioAac: Uint8Array,
  fps = 30,
): Promise<Blob> {
  const ff = await ensureFFmpegLoaded();

  await ff.writeFile('mux_video.h264', videoH264);
  await ff.writeFile('mux_audio.aac', audioAac);

  // ── Why we re-encode the video instead of `-c copy` ─────────────────
  // WebCodecs' VideoEncoder emits H.264 SPS NAL units WITHOUT VUI timing
  // (timing_info_present_flag = 0 — the elementary stream carries no
  // frame-rate metadata at all). VLC and HTML <video> tolerate this and
  // read the rate from the MP4 sample-table durations that `-r {fps}` sets.
  // But TikTok / Instagram / X transcoders read the SPS VUI first; finding
  // nothing, they assume the H.264 elementary-stream default of 25 fps and
  // re-encode the upload at that rate while the actual frames are
  // timestamped at {fps}fps. Their transcoder drops frames to fit the
  // assumed 25fps timeline — that's the "framerate drop after upload"
  // users report.
  //
  // Earlier attempt: `-bsf:v h264_metadata=tick_rate=...:fixed_frame_rate_flag=1`
  // to rewrite the SPS in-place. That broke browser decode because the
  // rewritten SPS / auto-generated avcC pair was malformed under
  // ffmpeg.wasm's build of that BSF (see commit c80cc40).
  //
  // The reliable fix is a single-pass libx264 re-encode. libx264 ALWAYS
  // writes proper VUI timing (time_scale / num_units_in_tick /
  // fixed_frame_rate_flag) and a matching avcC, so the resulting MP4
  // decodes everywhere AND uploads to TikTok / Instagram at the correct
  // frame rate. Audio is still copied (already AAC).
  //
  // ultrafast + crf 18 keeps it fast and visually near-transparent;
  // -g sets a 2-second GOP for stable seeking; -pix_fmt yuv420p +
  // -profile:v high is the universally compatible H.264 flavor.
  try {
    await ff.exec([
      '-y',
      '-r', String(fps),
      '-i', 'mux_video.h264',
      '-i', 'mux_audio.aac',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'high',
      '-g', String(Math.max(2, Math.round(fps * 2))),
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-shortest',
      'mux_output.mp4',
    ]);
  } catch (err) {
    // Defensive fallback: if libx264 fails for any reason (codec missing,
    // OOM, weird input), produce the SOMETHING-decodable file via `-c copy`
    // so the render doesn't outright fail. The fallback inherits the
    // "no SPS VUI" problem, but at least the user gets a playable file.
    console.warn('libx264 re-encode failed in mux; falling back to copy:', err);
    await ff.exec([
      '-y',
      '-r', String(fps),
      '-i', 'mux_video.h264',
      '-i', 'mux_audio.aac',
      '-c', 'copy',
      '-movflags', '+faststart',
      '-shortest',
      'mux_output.mp4',
    ]);
  }

  const result = await ff.readFile('mux_output.mp4') as Uint8Array;

  await ff.deleteFile('mux_video.h264').catch(() => {});
  await ff.deleteFile('mux_audio.aac').catch(() => {});
  await ff.deleteFile('mux_output.mp4').catch(() => {});

  return new Blob([result], { type: 'video/mp4' });
}

/**
 * Encode one bounded batch of raw RGBA frames into an H.264 Annex B stream.
 *
 * This is the building block of the chunked ffmpeg fallback (used when the
 * WebCodecs VideoEncoder is unavailable, e.g. older Safari/Firefox). Callers
 * feed frames a segment at a time and concatenate the returned Annex B
 * segments, so the whole clip's raw frames never sit in memory at once — the
 * previous "buffer every frame" approach OOMed on real clips (a 1080x1920
 * frame is ~8 MB, so a few minutes of footage is many GB).
 *
 * Each segment is independently encoded and therefore starts with SPS/PPS and
 * an IDR keyframe, which makes the concatenated Annex B stream cleanly
 * decodable and remuxable by {@link muxVideoAudio}.
 *
 * @param frames  Raw RGBA frames, each a Uint8Array of width*height*4 bytes
 * @param fps     Frames per second
 * @param width   Frame width (even)
 * @param height  Frame height (even)
 */
export async function encodeRgbaFramesToH264(
  frames: Uint8Array[],
  fps: number,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const ff = await ensureFFmpegLoaded();

  const frameSize = width * height * 4;
  const rawBuffer = new Uint8Array(frames.length * frameSize);
  let offset = 0;
  for (const frame of frames) {
    rawBuffer.set(frame, offset);
    offset += frameSize;
  }

  await ff.writeFile('seg_frames.rgba', rawBuffer);

  await ff.exec([
    '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${width}x${height}`,
    '-r', String(fps),
    '-i', 'seg_frames.rgba',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-f', 'h264',
    'seg_frames.h264',
  ]);

  const result = await ff.readFile('seg_frames.h264') as Uint8Array;

  await ff.deleteFile('seg_frames.rgba').catch(() => {});
  await ff.deleteFile('seg_frames.h264').catch(() => {});

  // Copy out before MEMFS is reused so the returned bytes stay valid.
  return result.slice();
}

/**
 * Check if WebCodecs VideoEncoder is available and functional.
 */
export async function isWebCodecsSupported(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01F',
      width: 640,
      height: 480,
    });
    return support.supported ?? false;
  } catch {
    return false;
  }
}

/**
 * Reset the ffmpeg instance (useful after errors).
 */
export function resetFFmpeg(): void {
  ffmpegInstance = null;
  loadPromise = null;
}
