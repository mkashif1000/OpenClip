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

import { isGoogleFont } from './fonts';

// One in-flight/settled promise per family so we never fetch twice.
const cache = new Map<string, Promise<void>>();

function fontSet(): FontFaceSet | undefined {
  return typeof document !== 'undefined'
    ? document.fonts
    : (self as unknown as { fonts?: FontFaceSet }).fonts;
}

async function loadOne(family: string): Promise<void> {
  if (!family || !isGoogleFont(family)) return;
  const set = fontSet();
  if (!set || typeof FontFace === 'undefined') return;
  // Load normal captions and bold titles, including every Unicode subset.
  // Register identical font bytes/weights in the document and export worker.
  const singleWeight = ['Anton', 'Archivo Black', 'Bebas Neue', 'Bangers'].includes(family);
  const weights = singleWeight ? '400' : '400;700';
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights}&display=swap`;
  const response = await fetch(cssUrl);
  if (!response.ok) throw new Error(`Font CSS: ${response.status}`);
  const css = await response.text();
  const faces = css.split('@font-face').slice(1).map(async (block) => {
    const url = block.match(/url\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) return;
    const weight = block.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? '400';
    const unicodeRange = block.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Font file: ${response.status}`);
    const face = new FontFace(family, await response.arrayBuffer(), {
      weight, style: 'normal', ...(unicodeRange ? { unicodeRange } : {}),
    });
    await face.load();
    set.add(face);
  });
  await Promise.all(faces);
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
