/**
 * B-roll footage search + download via Pexels and Pixabay (both free, both
 * CORS-enabled so they work from the browser with no backend). The user
 * supplies their own keys (stored in settingsStore / localStorage).
 *
 * Everything is optional: if no key is set for a provider it's simply skipped.
 */

export interface BrollCandidate {
  provider: 'pexels' | 'pixabay';
  id: string;
  url: string;        // direct .mp4 URL to download
  width: number;
  height: number;
  durationSec: number;
}

export interface BrollSearchKeys {
  pexels?: string;
  pixabay?: string;
}

export type BrollOrientation = 'portrait' | 'landscape';

/**
 * Search both providers for a query and return ranked candidates whose
 * resolution and duration are usable for `minDurationSec`.
 */
export async function searchBroll(
  query: string,
  orientation: BrollOrientation,
  minDurationSec: number,
  keys: BrollSearchKeys,
  signal?: AbortSignal,
): Promise<BrollCandidate[]> {
  const out: BrollCandidate[] = [];
  const results = await Promise.allSettled([
    keys.pexels ? searchPexels(query, orientation, keys.pexels, signal) : Promise.resolve([]),
    keys.pixabay ? searchPixabay(query, keys.pixabay, signal) : Promise.resolve([]),
  ]);
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);

  const wantPortrait = orientation === 'portrait';
  return out
    .filter((c) => c.durationSec >= Math.min(minDurationSec, 2)) // tolerate short
    .map((c) => {
      const isPortrait = c.height >= c.width;
      // Prefer matching orientation and ~1080p-class resolution (avoid 4K bloat).
      const orientationScore = isPortrait === wantPortrait ? 0 : 1000;
      const targetLongEdge = 1280;
      const longEdge = Math.max(c.width, c.height);
      const resScore = Math.abs(longEdge - targetLongEdge) / 100;
      return { c, score: orientationScore + resScore };
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.c);
}

/**
 * Search → pick the best non-excluded candidate → download it into memory.
 * Returns the candidate + a File (used directly by the render's mp4 decoder),
 * or null if nothing suitable was found. `exclude` holds provider:id pairs
 * already used so clips don't repeat within one render.
 */
export async function fetchBrollClip(
  query: string,
  orientation: BrollOrientation,
  minDurationSec: number,
  keys: BrollSearchKeys,
  exclude: Set<string>,
  signal?: AbortSignal,
): Promise<{ candidate: BrollCandidate; file: File } | null> {
  const candidates = await searchBroll(query, orientation, minDurationSec, keys, signal);
  for (const c of candidates) {
    const tag = `${c.provider}:${c.id}`;
    if (exclude.has(tag)) continue;
    try {
      const res = await fetch(c.url, { signal });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1024) continue; // guard against empty/error bodies
      exclude.add(tag);
      return { candidate: c, file: new File([buf], `broll_${c.provider}_${c.id}.mp4`, { type: 'video/mp4' }) };
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// ─── Pexels ─────────────────────────────────────────────────────────────────

async function searchPexels(
  query: string,
  orientation: BrollOrientation,
  key: string,
  signal?: AbortSignal,
): Promise<BrollCandidate[]> {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=10&size=medium`;
  const res = await fetch(url, { headers: { Authorization: key }, signal });
  if (!res.ok) return [];
  const json = await res.json() as {
    videos?: Array<{
      id: number; duration: number;
      video_files?: Array<{ link: string; width: number; height: number; quality?: string; file_type?: string }>;
    }>;
  };
  const out: BrollCandidate[] = [];
  for (const v of json.videos ?? []) {
    // Pick an mp4 file closest to 1080p-class long edge.
    const files = (v.video_files ?? []).filter((f) => (f.file_type ?? '').includes('mp4') && f.width && f.height);
    if (!files.length) continue;
    const best = files.sort((a, b) =>
      Math.abs(Math.max(a.width, a.height) - 1280) - Math.abs(Math.max(b.width, b.height) - 1280),
    )[0];
    out.push({
      provider: 'pexels', id: String(v.id), url: best.link,
      width: best.width, height: best.height, durationSec: v.duration || 0,
    });
  }
  return out;
}

// ─── Pixabay ────────────────────────────────────────────────────────────────

async function searchPixabay(
  query: string,
  key: string,
  signal?: AbortSignal,
): Promise<BrollCandidate[]> {
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&per_page=10&safesearch=true`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = await res.json() as {
    hits?: Array<{
      id: number; duration: number;
      videos?: Record<string, { url: string; width: number; height: number }>;
    }>;
  };
  const out: BrollCandidate[] = [];
  for (const h of json.hits ?? []) {
    const variants = Object.values(h.videos ?? {}).filter((f) => f.url && f.width && f.height);
    if (!variants.length) continue;
    const best = variants.sort((a, b) =>
      Math.abs(Math.max(a.width, a.height) - 1280) - Math.abs(Math.max(b.width, b.height) - 1280),
    )[0];
    out.push({
      provider: 'pixabay', id: String(h.id), url: best.url,
      width: best.width, height: best.height, durationSec: h.duration || 0,
    });
  }
  return out;
}
