/**
 * Loads Google Fonts into whatever FontFaceSet is available — `document.fonts`
 * on the main thread, `self.fonts` inside the render worker. The worker's
 * OffscreenCanvas can only draw text in a font that's registered in the
 * worker's own FontFaceSet, so the document's <link> in index.html is not
 * enough for the export pipeline; we fetch the woff2 bytes and register a
 * FontFace explicitly.
 *
 * COEP note: we use `fetch()` (CORS) for both the CSS and the woff2. Google
 * serves `access-control-allow-origin: *`, and a FontFace built from the
 * resulting ArrayBuffer is same-origin bytes — so this works under
 * `require-corp` exactly like the other cross-origin fetches in this app.
 */

import { isGoogleFont } from '@/data/fonts';

// One in-flight/settled promise per family so we never fetch twice.
const cache = new Map<string, Promise<void>>();

function fontSet(): FontFaceSet | undefined {
  // `self.fonts` is document.fonts on the main thread and the worker's set
  // inside a DedicatedWorkerGlobalScope.
  return (self as unknown as { fonts?: FontFaceSet }).fonts;
}

async function loadOne(family: string): Promise<void> {
  if (!family || !isGoogleFont(family)) return;
  const set = fontSet();
  if (!set || typeof FontFace === 'undefined') return;

  // Bold weights are what captions/titles use; request 700 (Google returns the
  // closest weight a family actually ships).
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@700&display=swap`;
  const css = await (await fetch(cssUrl)).text();

  // Google returns one @font-face block per unicode-range. We only need the
  // basic-latin block (covers English captions/titles) — loading every subset
  // would be megabytes. Match each block's url + unicode-range.
  const blocks = css.split('@font-face').slice(1);
  let loadedAny = false;
  for (const block of blocks) {
    const range = block.match(/unicode-range:\s*([^;]+);/)?.[1] ?? '';
    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    if (!url) continue;
    // Latin block starts at U+0000. If no range present, take it anyway.
    const isLatin = !range || /U\+0{2,4}/.test(range) || range.includes('U+0000');
    if (!isLatin) continue;
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      const ff = new FontFace(family, buf, { weight: '700', style: 'normal' });
      await ff.load();
      set.add(ff);
      loadedAny = true;
      break; // one latin block is enough
    } catch {
      /* try the next block */
    }
  }
  // Fallback: if no latin block matched, just load the first url present.
  if (!loadedAny) {
    const firstUrl = css.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    if (firstUrl) {
      try {
        const buf = await (await fetch(firstUrl)).arrayBuffer();
        const ff = new FontFace(family, buf, { weight: '700' });
        await ff.load();
        set.add(ff);
      } catch { /* give up — render falls back to a system font */ }
    }
  }
}

export function ensureFontLoaded(family: string): Promise<void> {
  if (!family || !isGoogleFont(family)) return Promise.resolve();
  let p = cache.get(family);
  if (!p) {
    p = loadOne(family).catch((e) => {
      console.warn('Font load failed:', family, e);
    });
    cache.set(family, p);
  }
  return p;
}

export async function ensureFontsLoaded(families: Array<string | null | undefined>): Promise<void> {
  const uniq = [...new Set(families.filter((f): f is string => !!f))];
  await Promise.all(uniq.map(ensureFontLoaded));
}
