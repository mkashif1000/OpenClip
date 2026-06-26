/**
 * Client-side clip detector.
 * Replaces the server's /clips/detect and /clips/load-json endpoints.
 * Uses utilities already in @openclip/shared (parseSrt, findViralClips, loadClipsFromJson).
 */

import { v4 as uuid } from 'uuid';
import type { ClipData, SubtitleEntry } from '@/types';
import { parseSrt, findViralClips, loadClipsFromJson, timeToSeconds } from '@viral-clipper/shared/utils';
import { opfsReadFile } from './opfs';

export interface DetectParams {
  min_duration: number;
  max_duration: number;
  max_clips: number;
}

/**
 * Read SRT content from OPFS and parse it into subtitle entries.
 */
export async function readSrtEntries(srtFileId: string): Promise<SubtitleEntry[]> {
  const file = await opfsReadFile(srtFileId);
  const text = await file.text();
  return parseSrt(text) as SubtitleEntry[];
}

/**
 * Read SRT content from a File object (before OPFS storage).
 */
export async function readSrtEntriesFromFile(file: File): Promise<SubtitleEntry[]> {
  const text = await file.text();
  return parseSrt(text) as SubtitleEntry[];
}

/**
 * Read JSON content from OPFS.
 */
async function readJsonFromOpfs(jsonFileId: string): Promise<unknown> {
  const file = await opfsReadFile(jsonFileId);
  const text = await file.text();
  return JSON.parse(text);
}

/**
 * Detect viral clips from an SRT file stored in OPFS.
 * Returns fully-formed ClipData[] with subtitle entries populated.
 */
export async function detectClipsFromSrt(
  srtFileId: string,
  params: DetectParams,
): Promise<ClipData[]> {
  const allEntries = await readSrtEntries(srtFileId);
  const rawClips = findViralClips(
    allEntries,
    params.min_duration,
    params.max_duration,
    params.max_clips,
  );

  return rawClips.map((c, i) => ({
    clip_id: uuid().slice(0, 8),
    index: i + 1,
    title: c.title,
    start_time: c.start,
    end_time: c.end,
    duration: c.duration,
    score: c.score,
    preview_text: c.preview,
    entries: c.entries as SubtitleEntry[],
    status: 'pending' as const,
    output_file: null,
  }));
}

/**
 * Load clips from a JSON timestamps file + SRT file, both in OPFS.
 */
export async function loadClipsFromJsonFile(
  jsonFileId: string,
  srtFileId: string,
): Promise<ClipData[]> {
  const [jsonData, allEntries] = await Promise.all([
    readJsonFromOpfs(jsonFileId),
    readSrtEntries(srtFileId),
  ]);

  const rawClips = loadClipsFromJson(jsonData as any, allEntries);

  return rawClips.map((c, i) => ({
    clip_id: uuid().slice(0, 8),
    index: i + 1,
    title: c.title,
    start_time: c.start,
    end_time: c.end,
    duration: c.duration,
    score: c.score,
    preview_text: c.preview,
    entries: c.entries as SubtitleEntry[],
    status: 'pending' as const,
    output_file: null,
  }));
}

/**
 * Load clips from already-parsed JSON data (e.g. pasted from a chatbot) + the
 * SRT file in OPFS. Same normalization as loadClipsFromJsonFile, but skips the
 * file read since the caller already has the parsed value.
 */
export async function loadClipsFromJsonData(
  jsonData: unknown,
  srtFileId: string,
): Promise<ClipData[]> {
  const allEntries = await readSrtEntries(srtFileId);
  const rawClips = loadClipsFromJson(jsonData as any, allEntries);
  return rawClips.map((c, i) => ({
    clip_id: uuid().slice(0, 8),
    index: i + 1,
    title: c.title,
    start_time: c.start,
    end_time: c.end,
    duration: c.duration,
    score: c.score,
    preview_text: c.preview,
    entries: c.entries as SubtitleEntry[],
    status: 'pending' as const,
    output_file: null,
  }));
}

/**
 * Format an SRT file's entries as compact timestamped lines for the clip
 * prompt, e.g. "[01:23] So the first thing is…". Returns the text + a rough
 * word count so callers can warn about very long transcripts.
 */
export async function buildTranscriptForPrompt(
  srtFileId: string,
): Promise<{ text: string; words: number }> {
  const entries = await readSrtEntries(srtFileId);
  const lines: string[] = [];
  for (const e of entries) {
    const sec = timeToSeconds(e.start);
    lines.push(`[${formatStamp(sec)}] ${e.text.replace(/\s+/g, ' ').trim()}`);
  }
  const text = lines.join('\n');
  return { text, words: text.split(/\s+/).filter(Boolean).length };
}

function formatStamp(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Re-extract subtitle entries from an SRT file for a given time range.
 * Used when a clip's start/end times are edited.
 */
export async function extractEntriesForRange(
  srtFileId: string,
  startSec: number,
  endSec: number,
): Promise<SubtitleEntry[]> {
  const allEntries = await readSrtEntries(srtFileId);
  return allEntries.filter(
    (e) => timeToSeconds(e.start) >= startSec - 0.5 && timeToSeconds(e.end) <= endSec + 0.5,
  );
}

/**
 * Create a manual clip (no SRT detection).
 */
export function createManualClip(
  title: string,
  startTime: number,
  endTime: number,
  existingCount: number,
): ClipData {
  return {
    clip_id: uuid().slice(0, 8),
    index: existingCount + 1,
    title,
    start_time: startTime,
    end_time: endTime,
    duration: endTime - startTime,
    score: 0,
    preview_text: '',
    entries: [],
    status: 'pending',
    output_file: null,
  };
}
