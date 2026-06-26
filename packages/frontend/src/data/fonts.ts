/**
 * Curated font catalog for subtitles + titles.
 *
 * `google: true` fonts are loaded from Google Fonts — via the <link> in
 * index.html for the live preview (main thread / Remotion), and via the
 * FontFace API in fontLoader.ts for the worker export pipeline (which has its
 * own FontFaceSet that the document's <link> doesn't reach).
 *
 * System fonts (`google: false`) need no loading — they're always available in
 * both the document and the worker's OffscreenCanvas.
 */

export interface FontOption {
  /** font-family value used in CSS / canvas ctx.font. */
  value: string;
  /** Display label in the picker. */
  label: string;
  /** Whether it must be loaded from Google Fonts. */
  google: boolean;
}

export const FONT_OPTIONS: FontOption[] = [
  // ── Bold / display (great for titles + punchy captions) ──
  { value: 'Anton', label: 'Anton — Heavy Impact', google: true },
  { value: 'Archivo Black', label: 'Archivo Black', google: true },
  { value: 'Bebas Neue', label: 'Bebas Neue — Tall', google: true },
  { value: 'Oswald', label: 'Oswald — Condensed', google: true },
  { value: 'Teko', label: 'Teko — Narrow', google: true },
  { value: 'Bangers', label: 'Bangers — Comic', google: true },
  { value: 'Impact', label: 'Impact', google: false },

  // ── Modern sans (clean, versatile) ──
  { value: 'Inter', label: 'Inter', google: true },
  { value: 'Montserrat', label: 'Montserrat', google: true },
  { value: 'Poppins', label: 'Poppins', google: true },
  { value: 'Roboto', label: 'Roboto', google: true },
  { value: 'Rubik', label: 'Rubik', google: true },
  { value: 'Barlow', label: 'Barlow', google: true },

  // ── System classics ──
  { value: 'Arial', label: 'Arial', google: false },
  { value: 'Helvetica', label: 'Helvetica', google: false },
  { value: 'Verdana', label: 'Verdana', google: false },
  { value: 'Trebuchet MS', label: 'Trebuchet MS', google: false },
  { value: 'Tahoma', label: 'Tahoma', google: false },
  { value: 'Georgia', label: 'Georgia (Serif)', google: false },
  { value: 'Times New Roman', label: 'Times New Roman (Serif)', google: false },
];

const GOOGLE = new Set(FONT_OPTIONS.filter((f) => f.google).map((f) => f.value));

/** True if a family must be fetched from Google Fonts (vs. a system font). */
export function isGoogleFont(family: string): boolean {
  return GOOGLE.has(family);
}

/** A safe CSS font stack for a chosen family (falls back gracefully). */
export function fontStack(family?: string | null): string {
  const f = family && family.trim() ? family : 'Inter';
  return `'${f}', 'Inter', 'Helvetica Neue', Arial, sans-serif`;
}
