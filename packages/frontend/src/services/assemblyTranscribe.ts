/**
 * Fast cloud transcription via AssemblyAI.
 *
 * Optional alternative to on-device Whisper: high accuracy, word-level
 * timestamps, and it handles long files server-side (no chunking). Returns the
 * same { srtText, words, entries } shape as whisperService, so SRT generation,
 * karaoke captions and silence/filler removal all work unchanged.
 *
 * Direct browser calls (AssemblyAI sends CORS headers) — no backend needed.
 * Tradeoff: the clip audio is uploaded to AssemblyAI. The API key is supplied
 * by the user, stored only in their browser, and sent only over HTTPS to
 * api.assemblyai.com.
 */

import type { SubtitleEntry } from '@/types';
import { groupWordsIntoEntries, entriesToSrt, type WhisperWord, type WhisperProgress } from './whisperService';

const BASE = 'https://api.assemblyai.com/v2';

export async function transcribeWithAssemblyAI(opts: {
  videoOpfsId: string;
  durationSec: number;
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (p: WhisperProgress) => void;
}): Promise<{ srtText: string; words: WhisperWord[]; entries: SubtitleEntry[] }> {
  const { videoOpfsId, durationSec, apiKey, signal, onProgress } = opts;
  const auth = { Authorization: apiKey };

  // 1) Pull the audio for upload — stream-copied (fast + lossless) when
  //    possible, else a compact re-encode.
  onProgress?.({ stage: 'audio', pct: 5, detail: 'Extracting audio' });
  const { extractAudioForUpload } = await import('./ffmpegService');
  const audio = await extractAudioForUpload(videoOpfsId, durationSec);

  // 2) Upload it.
  signal?.throwIfAborted();
  onProgress?.({ stage: 'audio', pct: 25, detail: 'Uploading audio' });
  const upRes = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/octet-stream' },
    body: audio,
    signal,
  });
  if (!upRes.ok) throw new Error(errMsg(upRes.status, 'upload'));
  const { upload_url } = await upRes.json() as { upload_url: string };

  // 3) Request a transcript with word timestamps.
  signal?.throwIfAborted();
  onProgress?.({ stage: 'transcribe', pct: 45, detail: 'Queued for transcription' });
  const createRes = await fetch(`${BASE}/transcript`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, punctuate: true, format_text: true }),
    signal,
  });
  if (!createRes.ok) throw new Error(errMsg(createRes.status, 'create'));
  const { id } = await createRes.json() as { id: string };

  // 4) Poll until done.
  let words: WhisperWord[] = [];
  for (;;) {
    signal?.throwIfAborted();
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`${BASE}/transcript/${id}`, { headers: auth, signal });
    if (!pollRes.ok) throw new Error(errMsg(pollRes.status, 'status check'));
    const data = await pollRes.json() as {
      status: string;
      error?: string;
      words?: Array<{ text?: string; start?: number; end?: number }>;
    };

    if (data.status === 'completed') {
      words = (data.words ?? [])
        .map((w) => {
          const t0 = (w.start ?? 0) / 1000; // ms → s
          const t1 = (w.end ?? 0) / 1000;
          return { t0, t1: Math.max(t1, t0 + 0.02), text: (w.text ?? '').trim() };
        })
        .filter((w) => w.text);
      onProgress?.({ stage: 'transcribe', pct: 100, detail: 'Done' });
      break;
    }
    if (data.status === 'error') {
      throw new Error(`AssemblyAI: ${data.error || 'transcription failed'}`);
    }
    onProgress?.({
      stage: 'transcribe',
      pct: data.status === 'processing' ? 85 : 65,
      detail: data.status === 'processing' ? 'Transcribing' : 'Queued',
    });
  }

  if (!words.length) throw new Error('AssemblyAI returned no speech');
  const entries = groupWordsIntoEntries(words);
  return { srtText: entriesToSrt(entries), words, entries };
}

function errMsg(status: number, where: string): string {
  if (status === 401) return 'Invalid AssemblyAI API key — check it in Settings';
  if (status === 429) return 'AssemblyAI rate/credit limit reached';
  return `AssemblyAI ${where} failed (HTTP ${status})`;
}
