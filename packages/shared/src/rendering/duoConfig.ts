/** Persisted, optional extensions; absent fields keep legacy captions unchanged. */
export const DUO_EFFECTS = {
  rise: 'Soft rise', bounce: 'Elastic bounce', stamp: 'Stamp', slide: 'Side entrance',
  underline: 'Underline sweep', marker: 'Marker wipe', glow: 'Breathing glow',
  typewriter: 'Type-on', outline: 'Outline reveal', echo: 'Chromatic echo',
} as const;
export type DuoEffect = keyof typeof DUO_EFFECTS;
export interface DuoCaptionConfig {
  accent_font_name?: string;
  /** Accent size relative to base font. Keeps the size pairing when resized. */
  accent_scale?: number;
  accent_bold?: boolean;
  accent_italic?: boolean;
  duo_emphasis?: 'alternate' | 'last' | 'longest';
  duo_layout?: 'inline' | 'stacked';
  duo_effect?: DuoEffect;
}
