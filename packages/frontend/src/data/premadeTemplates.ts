/**
 * Premade podcast templates. These are read-only presets shipped with the
 * app — the user clicks a tile to apply the bundled styles + layout to all
 * clips in the current project.
 *
 * A template here is just a partial StyleConfig + layout hint + sensible
 * defaults for the customizer drawer. Applying it overwrites the global
 * project styles via styleStore.setStyles().
 */

import type { StyleConfig, CaptionPreset } from '@/types';
import {
  DEFAULT_SUBTITLE_STYLE, DEFAULT_TITLE_STYLE, DEFAULT_EXPORT,
} from '@/types';
import { loadTemplateOverride } from '@/lib/templateOverrides';

export interface PodcastTemplate {
  id: string;
  name: string;
  blurb: string;
  /** Which gallery section the tile renders in (default: 'podcast'). */
  category?: 'podcast' | 'creator';
  /** "Hides" the title overlay (kept enabled to support the customizer's preview). */
  hideTitle?: boolean;
  /** Layout for clips that adopt this template. */
  layout: 'standard' | 'boxed' | 'split-2h' | 'split-2v';
  /** Default caption preset; the customizer can change it. */
  captionPreset: CaptionPreset;
  /** Pre-baked style overrides applied on top of the project defaults. */
  styles: () => StyleConfig;
}

const baseStyles = (): StyleConfig => ({
  subtitle: { ...DEFAULT_SUBTITLE_STYLE },
  title: { ...DEFAULT_TITLE_STYLE },
  export: { ...DEFAULT_EXPORT },
});

export const PODCAST_TEMPLATES: PodcastTemplate[] = [
  {
    id: 'pod_clean_captions',
    name: 'Clean Captions',
    blurb: 'No title overlay — just bold karaoke-style captions front and center.',
    hideTitle: true,
    layout: 'standard',
    captionPreset: 'karaoke',
    styles: () => {
      const s = baseStyles();
      s.subtitle.preset = 'karaoke';
      s.subtitle.bold = true;
      s.subtitle.font_name = 'Arial';
      s.subtitle.font_size = 50;
      s.subtitle.primary_color = '#FFFFFF';
      s.subtitle.highlight_color = '#FFFF00';
      s.subtitle.outline_color = '#000000';
      s.subtitle.outline_width = 4;
      s.subtitle.margin_v = 281;
      s.subtitle.max_width = 90;
      // Hide title by zeroing the background and color so nothing draws even
      // if the clip has a title string. Saves users from custom code paths.
      s.title.bg_opacity = 0;
      s.title.font_color = '#00000000';
      return s;
    },
  },
  {
    id: 'pod_title_captions',
    name: 'Title + Captions',
    blurb: 'A bold framing title at the top + karaoke captions at the bottom.',
    layout: 'standard',
    captionPreset: 'karaoke',
    styles: () => {
      const s = baseStyles();
      // Captions — bold karaoke at the bottom.
      s.subtitle.preset = 'karaoke';
      s.subtitle.bold = true;
      s.subtitle.font_name = 'Arial';
      s.subtitle.font_size = 50;
      s.subtitle.primary_color = '#FFFFFF';
      s.subtitle.highlight_color = '#FFFF00';
      s.subtitle.margin_v = 264;
      s.subtitle.max_width = 90;
      // Title — framing heading in a rounded bar at the top.
      s.title.font_name = 'Inter';
      s.title.font_color = '#FFFFFF';
      s.title.highlight_color = '#FFD23F';
      s.title.accent_color = '#FF4D4D';
      s.title.bg_color = '#000000';
      s.title.bg_opacity = 0.78;
      s.title.position = 'top';
      s.title.position_y = 19;
      s.title.font_size = 40;
      s.title.padding = 18;
      s.title.border_radius = 40;
      s.title.max_chars_per_line = 25;
      s.title.max_width = 80;
      return s;
    },
  },
  {
    id: 'pod_boxed_video',
    name: 'Boxed Video',
    blurb: 'Rounded video card on a black backdrop with a punchy title above.',
    layout: 'boxed',
    captionPreset: 'karaoke',
    styles: () => {
      const s = baseStyles();
      // Captions — bold karaoke below the boxed video.
      s.subtitle.preset = 'karaoke';
      s.subtitle.bold = true;
      s.subtitle.font_name = 'Arial';
      s.subtitle.font_size = 41;
      s.subtitle.primary_color = '#FFFFFF';
      s.subtitle.highlight_color = '#FFD23F';
      s.subtitle.margin_v = 245;
      s.subtitle.max_width = 90;
      // Title — punchy multi-color heading above the box.
      s.title.font_name = 'Inter';
      s.title.font_color = '#FFFFFF';
      s.title.highlight_color = '#FFD23F';
      s.title.accent_color = '#FF4D4D';
      s.title.bg_color = '#000000';
      s.title.bg_opacity = 0;
      s.title.position = 'top';
      s.title.position_y = 20;
      s.title.font_size = 40;
      s.title.padding = 12;
      s.title.border_radius = 6;
      s.title.max_chars_per_line = 22;
      s.title.max_width = 86;
      // Boxed video geometry (% of frame) + corner radius (px).
      s.export.box_width = 88;
      s.export.box_height = 45;
      s.export.box_y = 26;
      s.export.box_radius = 30;
      return s;
    },
  },
  {
    id: 'pod_two_speaker_split',
    name: 'Two-Speaker Split',
    blurb: 'Both speakers stacked top/bottom — drag the boxes to frame each one.',
    hideTitle: true,
    layout: 'split-2h',
    captionPreset: 'karaoke',
    styles: () => {
      const s = baseStyles();
      // Captions — bold karaoke near the center seam, over both speakers.
      s.subtitle.preset = 'karaoke';
      s.subtitle.bold = true;
      s.subtitle.font_name = 'Arial';
      s.subtitle.font_size = 50;
      s.subtitle.primary_color = '#FFFFFF';
      s.subtitle.highlight_color = '#FFFF00';
      s.subtitle.outline_color = '#000000';
      s.subtitle.outline_width = 4;
      s.subtitle.margin_v = 281;
      s.subtitle.max_width = 90;
      // No title overlay — same trick as Clean Captions.
      s.title.bg_opacity = 0;
      s.title.font_color = '#00000000';
      return s;
    },
  },

  // ─── Creator caption styles (no title, standard layout — pure caption looks) ──
  ...creatorStyle('creator_hormozi', 'Hormozi', 'Huge pop captions with a green active word — the classic talking-head look.', (s) => {
    s.subtitle.preset = 'pop';
    s.subtitle.font_name = 'Montserrat';
    s.subtitle.font_size = 54;
    s.subtitle.highlight_color = '#86FF4D';
    s.subtitle.margin_v = 500;
    s.subtitle.max_width = 74;
  }),
  ...creatorStyle('creator_beast', 'Beast Mode', 'Loud Impact captions, yellow active word, thick outline.', (s) => {
    s.subtitle.preset = 'pop';
    s.subtitle.font_name = 'Impact';
    s.subtitle.font_size = 58;
    s.subtitle.highlight_color = '#FFE100';
    s.subtitle.outline_width = 5;
    s.subtitle.margin_v = 300;
  }),
  ...creatorStyle('creator_karaoke', 'Classic Karaoke', 'White captions, yellow word-by-word highlight. Works everywhere.', (s) => {
    s.subtitle.preset = 'karaoke';
    s.subtitle.font_name = 'Arial';
    s.subtitle.font_size = 50;
    s.subtitle.highlight_color = '#FFFF00';
    s.subtitle.margin_v = 281;
  }),
  ...creatorStyle('creator_neon', 'Neon', 'Cyan active word with a heavy dark outline — high-energy gaming vibe.', (s) => {
    s.subtitle.preset = 'karaoke';
    s.subtitle.font_name = 'Poppins';
    s.subtitle.font_size = 52;
    s.subtitle.highlight_color = '#00E5FF';
    s.subtitle.outline_width = 6;
    s.subtitle.margin_v = 300;
  }),
  ...creatorStyle('creator_newsbar', 'Minimal Bar', 'Clean text on a dark bar — calm, premium, brand-safe.', (s) => {
    s.subtitle.preset = 'minimal';
    s.subtitle.font_name = 'Inter';
    s.subtitle.font_size = 42;
    s.subtitle.bold = false;
    s.subtitle.margin_v = 220;
  }),
  ...creatorStyle('creator_alert', 'Highlight Pill', 'Active word on a red pill — urgent news/commentary energy.', (s) => {
    s.subtitle.preset = 'box';
    s.subtitle.font_name = 'Archivo Black';
    s.subtitle.font_size = 48;
    s.subtitle.highlight_color = '#FF3B30';
    s.subtitle.margin_v = 300;
  }),
];

/** Helper: a caption-only creator preset (standard layout, hidden title). */
function creatorStyle(
  id: string, name: string, blurb: string, tune: (s: StyleConfig) => void,
): PodcastTemplate[] {
  const styles = () => {
    const s = baseStyles();
    s.subtitle.bold = true;
    s.subtitle.primary_color = '#FFFFFF';
    s.subtitle.outline_color = '#000000';
    s.subtitle.max_width = 88;
    s.title.bg_opacity = 0;
    s.title.font_color = '#00000000';
    tune(s);
    return s;
  };
  return [{
    id, name, blurb,
    category: 'creator',
    hideTitle: true,
    layout: 'standard',
    captionPreset: (styles().subtitle.preset ?? 'karaoke') as CaptionPreset,
    styles,
  }];
}

export function getPodcastTemplate(id: string): PodcastTemplate | undefined {
  const template = PODCAST_TEMPLATES.find((t) => t.id === id);
  if (!template) return undefined;
  const saved = loadTemplateOverride(id);
  return { ...template, layout: saved?.layout ?? template.layout,
    hideTitle: saved?.title.enabled === undefined ? template.hideTitle : !saved.title.enabled };

}

/**
 * Resolve a podcast template's effective StyleConfig: its built-in defaults
 * merged with the user's saved cross-project customizations (if any). Used by
 * the renderer so a per-clip template assignment produces exactly what the user
 * configured/saved in the drawer.
 */
export function getPodcastStyleConfig(id: string): StyleConfig | undefined {
  const tpl = getPodcastTemplate(id);
  if (!tpl) return undefined;
  const s = tpl.styles();
  s.title.enabled = !tpl.hideTitle;
  const ov = loadTemplateOverride(id);
  if (ov) {
    s.subtitle = { ...s.subtitle, ...ov.subtitle, preset: ov.preset };
    s.title = { ...s.title, ...ov.title };
    s.export = {
      ...s.export,
      box_radius: ov.box.radius,
      box_width: ov.box.width,
      box_height: ov.box.height,
      box_y: ov.box.y,
    };
  }
  return s;
}
