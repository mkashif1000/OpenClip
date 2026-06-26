/**
 * Auto-assign per-word color tiers for a title so it reads like the punchy
 * multi-color viral titles (e.g. "YOUR [FUTURE SELF] IS PULLING YOU FORWARD,
 * THE {MIND-BENDING} THEORY"). Returns one tier per whitespace word:
 *   0 = base, 1 = highlight, 2 = accent.
 *
 * Heuristic: highlight the two strongest content words (longest non-stopword
 * tokens). The strongest gets tier 1, the second gets tier 2. If the title is
 * short, only one word is highlighted.
 */

const STOP = new Set([
  'the', 'and', 'but', 'for', 'are', 'was', 'were', 'his', 'her', 'its', 'our',
  'you', 'your', 'this', 'that', 'with', 'from', 'into', 'they', 'them', 'has',
  'had', 'have', 'will', 'just', 'not', 'who', 'why', 'how', 'what', 'when',
  'than', 'then', 'too', 'about', 'over', 'like', 'a', 'an', 'of', 'to', 'in',
  'is', 'it', 'on', 'he', 'she', 'we', 'be', 'as', 'at', 'or', 'so', 'i',
]);

export function autoTitleColors(title: string): number[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const colors = new Array(words.length).fill(0);
  if (words.length === 0) return colors;

  const scored = words
    .map((w, i) => ({ i, clean: w.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
    .filter((x) => x.clean.length >= 4 && !STOP.has(x.clean))
    .sort((a, b) => b.clean.length - a.clean.length);

  if (scored[0]) colors[scored[0].i] = 1;
  if (scored[1] && words.length > 4) colors[scored[1].i] = 2;
  return colors;
}

/** Resolve a tier index to its hex color from the title palette. */
export function tierColor(
  tier: number | undefined,
  base: string,
  highlight: string,
  accent: string,
): string {
  if (tier === 1) return highlight;
  if (tier === 2) return accent;
  return base;
}
