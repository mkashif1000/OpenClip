import type { SubtitleEntry } from '../types/index.js';

import { scoreViralPotential } from './scorer.js';

export function generateTitleFromEntries(entries: SubtitleEntry[]): string {
  if (!entries.length) return '';

  const intro = entries.slice(0, Math.max(Math.floor(entries.length / 3), 15));
  const fullIntro = intro.map(e => e.text).join(' ');

  // Split into sentences
  const rawSentences = fullIntro.split(/(?<=[.!?])\s+/);

  let best = '';
  let bestScore = -1;

  for (const sent of rawSentences) {
    const trimmed = sent.trim();
    const words = trimmed.split(/\s+/);
    if (words.length < 4 || words.length > 18) continue;

    const s = scoreViralPotential([{ start: '0', end: '0', text: trimmed }]);
    if (s > bestScore) {
      bestScore = s;
      best = trimmed;
    }
  }

  if (best) {
    const title = best.replace(/[.!?,;]+$/, '').trim();
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  // Fallback: proper nouns
  const caps = fullIntro.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const commonWords = new Set(['The', 'And', 'But', 'For', 'This', 'That', 'With', 'They', 'What', 'When', 'Where', 'How']);
  const freq: Record<string, number> = {};
  for (const w of caps) {
    if (!commonWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0]);
  if (topWords.length) return topWords.join(' \u00B7 ');

  // Last resort
  return entries[0].text.trim().replace(/[.!?]+$/, '').slice(0, 70);
}
