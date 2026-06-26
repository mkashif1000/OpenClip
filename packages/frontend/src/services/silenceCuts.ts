/**
 * Silence & filler-word removal (requires Whisper word timestamps).
 *
 * From the word timeline we compute the segments of a clip worth keeping:
 * long speech gaps are tightened to a short breath, and filler words
 * ("um", "uh", …) are cut entirely. The renderer maps its constant-fps output
 * grid through this piecewise timeline, and the audio is extracted per kept
 * segment and concatenated — video and audio share the exact same cut list,
 * so they cannot drift.
 */

import type { WhisperWord } from './whisperService';

export interface KeepSegment {
  start: number; // absolute source seconds
  end: number;
}

const FILLER_WORDS = new Set(['um', 'uh', 'uhh', 'umm', 'erm', 'hmm', 'mhm', 'mm', 'er', 'ehm']);
const MAX_GAP = 0.5;   // speech gaps longer than this get tightened…
const PAD = 0.12;      // …down to this much breathing room on each side
const MIN_KEEP = 0.15; // drop slivers shorter than this

export interface KeepSegmentOptions {
  /** When false, skip the automatic silence/filler-word cuts. */
  autoCuts?: boolean;
  /** Additional source-time ranges to cut (e.g. user-disabled transcript words). */
  extraCutRanges?: Array<{ start: number; end: number }>;
}

export function computeKeepSegments(
  words: WhisperWord[],
  clipStart: number,
  clipEnd: number,
  options: KeepSegmentOptions = { autoCuts: true },
): KeepSegment[] {
  const autoCuts = options.autoCuts !== false;
  const extras = options.extraCutRanges ?? [];
  const inRange = words
    .filter((w) => w.t1 > clipStart && w.t0 < clipEnd)
    .sort((a, b) => a.t0 - b.t0);
  const full: KeepSegment[] = [{ start: clipStart, end: clipEnd }];

  // Build the cut list (auto silence/filler + user-disabled ranges).
  const cuts: Array<{ s: number; e: number }> = [];

  if (autoCuts && inRange.length) {
    if (inRange[0].t0 - clipStart > MAX_GAP) {
      cuts.push({ s: clipStart, e: inRange[0].t0 - PAD });
    }
    for (let i = 0; i < inRange.length; i++) {
      const cur = inRange[i];
      const bare = cur.text.toLowerCase().replace(/[^a-z]/g, '');
      if (FILLER_WORDS.has(bare)) {
        cuts.push({ s: Math.max(cur.t0 - 0.03, clipStart), e: Math.min(cur.t1 + 0.03, clipEnd) });
      }
      const next = inRange[i + 1];
      if (next && next.t0 - cur.t1 > MAX_GAP) {
        cuts.push({ s: cur.t1 + PAD, e: next.t0 - PAD });
      }
    }
    const last = inRange[inRange.length - 1];
    if (clipEnd - last.t1 > MAX_GAP) {
      cuts.push({ s: last.t1 + PAD, e: clipEnd });
    }
  }

  // User-disabled ranges (transcript editor toggles).
  for (const r of extras) {
    const s = Math.max(r.start, clipStart);
    const e = Math.min(r.end, clipEnd);
    if (e - s > 0.01) cuts.push({ s, e });
  }

  if (!cuts.length) return full;

  // Merge overlapping cuts.
  cuts.sort((a, b) => a.s - b.s);
  const merged: Array<{ s: number; e: number }> = [];
  for (const c of cuts) {
    const s = Math.max(c.s, clipStart);
    const e = Math.min(c.e, clipEnd);
    if (e - s <= 0.01) continue;
    const prev = merged[merged.length - 1];
    if (prev && s <= prev.e + 0.01) prev.e = Math.max(prev.e, e);
    else merged.push({ s, e });
  }

  // Complement → keep segments.
  const keeps: KeepSegment[] = [];
  let cursor = clipStart;
  for (const c of merged) {
    if (c.s - cursor >= MIN_KEEP) keeps.push({ start: cursor, end: c.s });
    cursor = Math.max(cursor, c.e);
  }
  if (clipEnd - cursor >= MIN_KEEP) keeps.push({ start: cursor, end: clipEnd });

  const total = keeps.reduce((s, k) => s + (k.end - k.start), 0);
  // Safety: if cutting would leave almost nothing, keep the original clip.
  if (!keeps.length || total < 1) return full;
  return keeps;
}

export interface TimeMap {
  /** Total output duration after cuts. */
  duration: number;
  /** Source time for a given output time. */
  srcAt(outT: number): number;
}

export function makeTimeMap(keeps: KeepSegment[]): TimeMap {
  const starts: number[] = [];
  let acc = 0;
  for (const k of keeps) {
    starts.push(acc);
    acc += k.end - k.start;
  }
  const duration = acc;
  return {
    duration,
    srcAt(outT: number): number {
      if (outT <= 0) return keeps[0].start;
      for (let i = keeps.length - 1; i >= 0; i--) {
        if (outT >= starts[i]) {
          return Math.min(keeps[i].start + (outT - starts[i]), keeps[i].end);
        }
      }
      return keeps[keeps.length - 1].end;
    },
  };
}
