import type { SubtitleEntry } from '../types/index.js';
import { timeToSeconds } from './srt.js';

export const HOOK_KEYWORDS = [
  "secret", "truth", "revealed", "nobody knows", "everyone", "never", "always",
  "actually", "real reason", "real story", "finally", "discovered", "turns out",
  "shocking", "insane", "crazy", "unbelievable", "mind-blowing", "game-changer",
  "incredible", "unreal", "wild", "brutal", "terrifying", "jaw-dropping",
  "warning", "stop", "don't", "mistake", "wrong", "avoid", "danger",
  "how to", "hack", "trick", "tip", "simple", "easy", "fast", "quickest",
  "you need", "you should", "you must", "here's why", "this is why", "that's why",
  "billion", "million", "thousand", "percent", "%", "$",
  "most people", "the problem", "the issue", "here's the thing", "the truth is",
  "what if", "imagine", "picture this", "think about",
  "i was", "i used to", "one day", "at first", "changed my life", "changed everything",
  "literally", "no cap", "fr", "lowkey", "honestly", "real talk",
];

export function scoreViralPotential(entries: SubtitleEntry[]): number {
  const fullText = entries.map(e => e.text).join(' ').toLowerCase();
  let score = 0;

  for (const kw of HOOK_KEYWORDS) {
    if (fullText.includes(kw)) score += 3;
  }

  score += (fullText.match(/\?/g) || []).length * 4;
  score += Math.min((fullText.match(/!/g) || []).length * 2, 8);

  const nums = fullText.match(/\b\d[\d,]*\.?\d*\b/g) || [];
  score += Math.min(nums.length * 2, 10);

  const sentences = fullText.split(/[.!?]+/).filter(s => s.trim());
  const avgLen = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / Math.max(sentences.length, 1);
  if (avgLen >= 8 && avgLen <= 20) score += 5;

  const wordCount = fullText.split(/\s+/).length;
  if (wordCount >= 50) score += 5;
  if (wordCount < 20) score -= 10;

  const firstSentence = fullText.split(/[.!?]/)[0] || '';
  for (const kw of HOOK_KEYWORDS.slice(0, 20)) {
    if (firstSentence.includes(kw)) { score += 5; break; }
  }

  // Strong open: a question in the first couple of lines pulls viewers in.
  const opening = entries.slice(0, 2).map((e) => e.text).join(' ');
  if (opening.includes('?')) score += 6;

  // Payoff ending: clips that land on a punchline/resolution retain better
  // than ones that trail off.
  const lastText = (entries[entries.length - 1]?.text || '').trim().toLowerCase();
  if (/[!?]$/.test(lastText)) score += 6;
  if (/\b(that's why|turns out|the answer|exactly|and that's|no way|insane|crazy|unbelievable)\b/.test(lastText)) score += 4;
  // A clip ending mid-thought ("...and", "...because") feels cut off.
  if (/\b(and|but|so|because|which|that|the|a|an|to|of|with|or)$/.test(lastText.replace(/["'.,!?\s]+$/, ''))) {
    score -= 8;
  }

  return Math.max(score, 0);
}

function isSentenceEnd(text: string): boolean {
  const t = text.trim().replace(/["'\u00bb)]+$/, '');
  return t.length > 0 && /[.!?]$/.test(t);
}


export function findViralClips(
  entries: SubtitleEntry[],
  minDur = 30,
  maxDur = 60,
  topN = 10
): Array<{
  start: number; end: number; duration: number; score: number;
  title: string; preview: string; entries: SubtitleEntry[];
}> {
  if (!entries.length) return [];

  const n = entries.length;

  const sentenceStarts = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (i === 0) sentenceStarts.add(i);
    else if (isSentenceEnd(entries[i - 1].text)) sentenceStarts.add(i);
  }

  const sentenceEnds = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (isSentenceEnd(entries[i].text)) sentenceEnds.add(i);
  }

  if (sentenceEnds.size === 0) for (let i = 0; i < n; i++) sentenceEnds.add(i);
  if (sentenceStarts.size === 0) for (let i = 0; i < n; i++) sentenceStarts.add(i);

  const candidates: Array<{
    start: number; end: number; duration: number; score: number;
    title: string; preview: string; entries: SubtitleEntry[];
  }> = [];

  for (const i of sentenceStarts) {
    const startSec = timeToSeconds(entries[i].start);
    let j = i;
    while (j < n) {
      const endSec = timeToSeconds(entries[j].end);
      if (endSec - startSec <= maxDur) j++;
      else break;
    }

    let k = j - 1;
    while (k >= i) {
      if (sentenceEnds.has(k)) {
        const endSec = timeToSeconds(entries[k].end);
        const duration = endSec - startSec;
        if (duration >= minDur) {
          const window = entries.slice(i, k + 1);
          // Sweet-spot length bonus: 25-50s clips hold attention best on
          // short-form platforms.
          const lengthBonus = duration >= 25 && duration <= 50 ? 4 : 0;
          const score = scoreViralPotential(window) + lengthBonus;
          const preview = window.slice(0, 3).map(e => e.text).join(' ').slice(0, 120);
          candidates.push({ start: startSec, end: endSec, duration, score, title: '', preview, entries: window });
          break;
        }
      }
      k--;
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Greedy pick by score, skipping overlaps and near-duplicates (clips
  // starting within 10s of an already-picked one) so the selection spreads
  // across the whole video instead of clustering on one hot section.
  const selected: typeof candidates = [];
  for (const c of candidates) {
    const overlap = selected.some(s => c.start < s.end && c.end > s.start);
    const tooClose = selected.some(s => Math.abs(c.start - s.start) < 10);
    if (!overlap && !tooClose) {
      selected.push(c);
      if (selected.length >= topN) break;
    }
  }

  selected.sort((a, b) => a.start - b.start);
  return selected;
}
