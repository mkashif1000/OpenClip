/**
 * In-browser speech-to-text via Whisper (transformers.js / ONNX Runtime).
 *
 * Optional feature: generates an SRT (caption lines) plus word-level
 * timestamps from the project's video, entirely on-device. The model
 * (~80 MB, quantized whisper-base) is downloaded once and cached by the
 * browser. Uses WebGPU when available, WASM otherwise.
 *
 * The regular SRT-upload flow is untouched — this just produces the same
 * artifacts automatically, with word timing precise enough to drive the
 * karaoke captions and the silence/filler-removal feature.
 */

import type { SubtitleEntry } from '@/types';
import { secondsToSrtTime } from '@viral-clipper/shared/utils';

export interface WhisperWord {
  t0: number;
  t1: number;
  text: string;
}

export interface WhisperProgress {
  /** 'model' = downloading weights, 'audio' = extracting PCM, 'transcribe' = running the model */
  stage: 'model' | 'audio' | 'transcribe';
  /** 0-100 across the whole job */
  pct: number;
  detail?: string;
}

const MODEL_ID = 'onnx-community/whisper-base';
const SEGMENT_SEC = 600; // process the source in 10-minute chunks (bounded memory)

type AsrPipeline = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{
  text: string;
  chunks?: Array<{ text: string; timestamp: [number, number | null] }>;
}>;

let asrPromise: Promise<AsrPipeline> | null = null;

async function getAsr(onModelPct?: (pct: number) => void): Promise<AsrPipeline> {
  if (!asrPromise) {
    asrPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const progress_callback = (p: { status?: string; loaded?: number; total?: number; file?: string }) => {
        if (p.status === 'progress' && p.total) {
          onModelPct?.(Math.min(99, Math.round(((p.loaded ?? 0) / p.total) * 100)));
        }
      };
      const make = (device: 'webgpu' | 'wasm') =>
        pipeline('automatic-speech-recognition', MODEL_ID, {
          device,
          dtype: 'q8',
          progress_callback,
        } as Record<string, unknown>) as unknown as Promise<AsrPipeline>;

      if ((navigator as { gpu?: unknown }).gpu) {
        try {
          return await make('webgpu');
        } catch (err) {
          console.warn('WebGPU Whisper init failed, falling back to WASM:', err);
        }
      }
      return make('wasm');
    })();
    // Allow a retry on failure instead of caching a rejected promise.
    asrPromise.catch(() => { asrPromise = null; });
  }
  return asrPromise;
}

/**
 * Transcribe the project's video. Returns SRT text (grouped caption lines),
 * the raw word timeline, and parsed entries.
 */
export async function transcribeVideo(opts: {
  videoOpfsId: string;
  durationSec: number;
  signal?: AbortSignal;
  onProgress?: (p: WhisperProgress) => void;
}): Promise<{ srtText: string; words: WhisperWord[]; entries: SubtitleEntry[] }> {
  const { videoOpfsId, durationSec, signal, onProgress } = opts;

  onProgress?.({ stage: 'model', pct: 0, detail: 'Loading Whisper model' });
  const asr = await getAsr((pct) => onProgress?.({ stage: 'model', pct: Math.round(pct * 0.1), detail: `Downloading model ${pct}%` }));

  const { extractPcmF32Mono } = await import('./ffmpegService');

  const words: WhisperWord[] = [];
  const segments = Math.max(1, Math.ceil(durationSec / SEGMENT_SEC));

  for (let s = 0; s < segments; s++) {
    signal?.throwIfAborted();
    const base = s * SEGMENT_SEC;
    const segDur = Math.min(SEGMENT_SEC, durationSec - base);
    if (segDur <= 0.2) break;

    const segPctBase = 10 + (s / segments) * 90;
    const segPctSpan = 90 / segments;
    onProgress?.({ stage: 'audio', pct: Math.round(segPctBase), detail: `Extracting audio ${s + 1}/${segments}` });
    const audio = await extractPcmF32Mono(videoOpfsId, base, segDur, 16000);

    signal?.throwIfAborted();
    onProgress?.({ stage: 'transcribe', pct: Math.round(segPctBase + segPctSpan * 0.25), detail: `Transcribing ${s + 1}/${segments}` });
    const result = await asr(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: 'word',
    });

    for (const chunk of result.chunks ?? []) {
      const text = (chunk.text ?? '').trim();
      if (!text) continue;
      const t0 = base + (chunk.timestamp?.[0] ?? 0);
      const t1 = base + (chunk.timestamp?.[1] ?? (chunk.timestamp?.[0] ?? 0) + 0.4);
      words.push({ t0, t1: Math.max(t1, t0 + 0.02), text });
    }
    onProgress?.({ stage: 'transcribe', pct: Math.round(segPctBase + segPctSpan), detail: `Transcribed ${s + 1}/${segments}` });
  }

  const entries = groupWordsIntoEntries(words);
  const srtText = entriesToSrt(entries);
  return { srtText, words, entries };
}

/**
 * Group the word stream into caption lines: short (≤5 words / ≤3.5s), broken
 * at sentence ends and speech gaps — reads naturally and keeps karaoke tight.
 */
export function groupWordsIntoEntries(words: WhisperWord[]): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  let line: WhisperWord[] = [];

  const flush = () => {
    if (!line.length) return;
    entries.push({
      start: secondsToSrtTime(line[0].t0),
      end: secondsToSrtTime(line[line.length - 1].t1),
      text: line.map((w) => w.text).join(' '),
    });
    line = [];
  };

  for (const w of words) {
    const prev = line[line.length - 1];
    const gap = prev ? w.t0 - prev.t1 : 0;
    const lineDur = line.length ? w.t1 - line[0].t0 : 0;
    const sentenceEnd = prev ? /[.!?]$/.test(prev.text) : false;
    if (line.length && (line.length >= 5 || gap > 0.8 || lineDur > 3.5 || sentenceEnd)) {
      flush();
    }
    line.push(w);
  }
  flush();
  return entries;
}

export function entriesToSrt(entries: SubtitleEntry[]): string {
  return entries
    .map((e, i) => `${i + 1}\n${e.start} --> ${e.end}\n${e.text}\n`)
    .join('\n');
}
