import type { SubtitleEntry } from '../types/index.js';
import { timeToSeconds } from './srt.js';

/** Accept a timestamp as seconds (number or numeric string) or "MM:SS"/"HH:MM:SS". */
function toSeconds(v: unknown): number {
  if (v == null) return NaN;
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  const s = String(v).trim();
  if (s === '') return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s); // plain seconds
  if (s.includes(':')) return timeToSeconds(s);       // MM:SS / HH:MM:SS
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function firstDefined<T>(...vals: T[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}

/**
 * Load clips from a JSON definition. Tolerant of common shapes:
 *  - a bare array, or an object wrapping the array under
 *    clips / segments / data / results / items
 *  - field aliases: start_time|start|startTime|from|begin, end_time|end|endTime|to,
 *    viral_chance_score|score|viral_score, title|name, text|preview|description
 *  - timestamps as seconds (number/string) or "MM:SS" / "HH:MM:SS"
 */
export function loadClipsFromJson(
  jsonData: unknown,
  allEntries: SubtitleEntry[]
) {
  let items: any[] = [];
  if (Array.isArray(jsonData)) {
    items = jsonData;
  } else if (jsonData && typeof jsonData === 'object') {
    const o = jsonData as Record<string, unknown>;
    const wrapped = o.clips ?? o.segments ?? o.data ?? o.results ?? o.items;
    if (Array.isArray(wrapped)) items = wrapped;
  }

  const clips: Array<{
    id: number; start: number; end: number; duration: number;
    score: number; title: string; preview: string; entries: SubtitleEntry[];
  }> = [];

  let idx = 0;
  for (const item of items) {
    idx++;
    if (!item || typeof item !== 'object') continue;

    const startSec = toSeconds(firstDefined(item.start_time, item.start, item.startTime, item.from, item.begin));
    const endSec = toSeconds(firstDefined(item.end_time, item.end, item.endTime, item.to));
    if (!isFinite(startSec) || !isFinite(endSec)) continue;
    const duration = endSec - startSec;
    if (duration <= 0) continue;

    const window = allEntries.filter(e =>
      timeToSeconds(e.start) >= startSec - 0.5 &&
      timeToSeconds(e.end) <= endSec + 0.5
    );

    const scoreRaw = firstDefined(item.viral_chance_score, item.score, item.viral_score, 0);
    const score = parseInt(String(scoreRaw), 10) || 0;

    clips.push({
      id: typeof item.id === 'number' ? item.id : idx,
      start: startSec,
      end: endSec,
      duration,
      score,
      title: String(firstDefined(item.title, item.name, '') ?? ''),
      preview: String(firstDefined(item.text, item.preview, item.description, '') ?? '').slice(0, 120),
      entries: window,
    });
  }

  clips.sort((a, b) => a.start - b.start);
  return clips;
}
