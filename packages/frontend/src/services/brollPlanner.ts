/**
 * B-roll planner — decides WHERE B-roll goes and WHICH query to search.
 *
 * Keyword mode (no extra API): groups the transcript into sentences, extracts
 * the most "visual" content words from each, and places short B-roll spans on
 * the strongest ones — subject to rules that keep it tasteful (protect the
 * hook/payoff, cap density and total coverage, avoid PIP ranges).
 *
 * Output is a list of { start, end, query } in absolute source seconds, which
 * the render pipeline turns into downloaded footage shown over those spans.
 * (An LLM-driven planner can later produce the same shape for smarter picks.)
 */

import type { WhisperWord } from './whisperService';

export interface BrollSpan {
  start: number;
  end: number;
  query: string;
}

export interface BrollPlanOptions {
  hookSkipSec?: number;      // keep the speaker on screen at the start
  payoffSkipSec?: number;    // ...and at the end
  minGapSec?: number;        // min gap between consecutive B-rolls
  minDurSec?: number;
  maxDurSec?: number;
  maxCoverageFrac?: number;  // cap total B-roll time as a fraction of the clip
  avoidRanges?: Array<{ start: number; end: number }>; // e.g. PIP spans (absolute sec)
}

const DEFAULTS: Required<Omit<BrollPlanOptions, 'avoidRanges'>> = {
  hookSkipSec: 3,
  payoffSkipSec: 2,
  minGapSec: 6,
  minDurSec: 2.5,
  maxDurSec: 4,
  maxCoverageFrac: 0.45,
};

// Common words that are never useful as stock-footage queries.
const STOPWORDS = new Set([
  'that', 'this', 'these', 'those', 'they', 'them', 'their', 'there', 'here',
  'what', 'when', 'where', 'which', 'while', 'with', 'without', 'within',
  'have', 'just', 'like', 'really', 'going', 'gonna', 'wanna', 'because',
  'about', 'would', 'could', 'should', 'might', 'must', 'will', 'shall', 'been',
  'being', 'were', 'your', 'yours', 'mine', 'ours', 'then', 'than',
  'into', 'onto', 'from', 'over', 'under', 'again', 'still', 'even', 'also',
  'some', 'such', 'very', 'much', 'more', 'most', 'many', 'every', 'each',
  'thing', 'things', 'something', 'anything', 'everything', 'nothing', 'someone',
  'people', 'person', 'guys', 'kind', 'sort', 'stuff', 'okay', 'yeah', 'know',
  'think', 'thought', 'mean', 'said', 'says', 'tell', 'told', 'talk', 'talking',
  'right', 'left', 'good', 'great', 'better', 'best', 'actually', 'literally',
  'basically', 'maybe', 'probably', 'definitely', 'honestly', 'anyway',
  // Common abstract / discourse words that read poorly as footage queries.
  'discuss', 'explain', 'example', 'mention', 'point', 'idea', 'story', 'moment',
  'reason', 'course', 'number', 'times', 'today', 'started', 'around', 'before',
  'after', 'between', 'different', 'important', 'problem', 'question', 'answer',
  'happen', 'happened', 'become', 'became', 'always', 'never', 'sometimes',
  'thought', 'feeling', 'feel', 'felt', 'want', 'wanted', 'need', 'needed',
]);

/**
 * Pick query keywords AND anchor time from the words themselves.
 * The query is the 2 longest content words in spoken order; the anchor is the
 * t0 of the earliest of those words — that's when the speaker actually says it,
 * so cutting to B-roll at the anchor lands the visual ON the word (the standard
 * editing convention) instead of seconds before it.
 */
function extractQueryAndAnchor(
  words: WhisperWord[],
): { query: string; anchor: number } | null {
  const candidates = words
    .map((w) => ({ w, clean: w.text.toLowerCase().replace(/[^a-z0-9]/g, '') }))
    .filter((c) => c.clean.length >= 4 && !STOPWORDS.has(c.clean));
  if (!candidates.length) return null;

  // Top 2 distinct lemmas by length (rough proxy for concreteness).
  const distinct = new Map<string, typeof candidates[0]>();
  for (const c of candidates) if (!distinct.has(c.clean)) distinct.set(c.clean, c);
  const byLen = [...distinct.values()].sort((a, b) => b.clean.length - a.clean.length).slice(0, 2);
  if (!byLen.length) return null;

  const inTime = [...byLen].sort((a, b) => a.w.t0 - b.w.t0);
  const query = inTime.map((c) => c.clean).join(' ').trim();
  if (query.length < 4) return null;
  return { query, anchor: inTime[0].w.t0 };
}

interface Sentence { start: number; end: number; words: WhisperWord[] }

function groupSentences(words: WhisperWord[]): Sentence[] {
  const sentences: Sentence[] = [];
  let cur: WhisperWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    sentences.push({ start: cur[0].t0, end: cur[cur.length - 1].t1, words: cur });
    cur = [];
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const gap = prev ? w.t0 - prev.t1 : 0;
    if (cur.length && (/[.!?]$/.test(prev!.text) || gap > 0.7 || (w.t1 - cur[0].t0) > 6)) flush();
    cur.push(w);
  }
  flush();
  return sentences;
}

export function planBroll(
  words: WhisperWord[],
  clipStart: number,
  clipEnd: number,
  options: BrollPlanOptions = {},
): BrollSpan[] {
  const o = { ...DEFAULTS, ...options };
  const clipDur = clipEnd - clipStart;
  if (clipDur < o.hookSkipSec + o.payoffSkipSec + o.minDurSec) return [];

  const regionStart = clipStart + o.hookSkipSec;
  const regionEnd = clipEnd - o.payoffSkipSec;
  const maxCoverage = clipDur * o.maxCoverageFrac;
  const avoid = options.avoidRanges ?? [];

  const overlaps = (s: number, e: number, list: Array<{ start: number; end: number }>) =>
    list.some((r) => s < r.end && e > r.start);

  const inRange = words.filter((w) => w.t1 > regionStart && w.t0 < regionEnd);
  const sentences = groupSentences(inRange);

  const spans: BrollSpan[] = [];
  const usedQueries = new Set<string>();
  let coverage = 0;
  let lastEnd = -Infinity;

  for (const s of sentences) {
    if (coverage >= maxCoverage) break;

    const picked = extractQueryAndAnchor(s.words);
    if (!picked || usedQueries.has(picked.query)) continue;

    // Anchor the cut on the keyword itself so the visual lands when the
    // speaker says the word, not at the sentence start.
    const start = Math.max(picked.anchor, regionStart);
    if (start - lastEnd < o.minGapSec) continue;

    const avail = Math.min(s.end, regionEnd) - start;
    if (avail < o.minDurSec) continue;

    const dur = Math.min(o.maxDurSec, Math.max(o.minDurSec, avail));
    const end = start + dur;
    if (end > regionEnd) continue;
    if (overlaps(start, end, avoid)) continue;
    if (coverage + dur > maxCoverage) continue;

    spans.push({ start, end, query: picked.query });
    usedQueries.add(picked.query);
    coverage += dur;
    lastEnd = end;
  }

  return spans;
}
