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

export interface PodcastTemplate {
  id: string;
  name: string;
  blurb: string;
  /** "Hides" the title overlay (kept enabled to support the customizer's preview). */
  hideTitle?: boolean;
  /** Layout for clips that adopt this template. */
  layout: 'standard' | 'boxed';
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
      s.subtitle.primary_color = '#FFFFFF';
      s.subtitle.highlight_color = '#FFFF00';
      s.subtitle.outline_color = '#000000';
      s.subtitle.outline_width = 4;
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
      s.subtitle.preset = 'karaoke';
      s.subtitle.bold = true;
      s.subtitle.primary_color = '#FFFFFF';
      s.subtitle.highlight_color = '#FFFF00';
      s.title.font_color = '#FFFFFF';
      s.title.bg_color = '#000000';
      s.title.bg_opacity = 0.78;
      s.title.position = 'top';
      s.title.position_y = 8;
      s.title.padding = 18;
      s.title.border_radius = 10;
      s.title.max_chars_per_line = 25;
      return s;
    },
  },
  {
    id: 'pod_boxed_video',
    name: 'Boxed Video',
    blurb: 'Rounded video card on a black backdrop with a punchy title above.',
    layout: 'boxed',
    captionPreset: 'pop',
    styles: () => {
      const s = baseStyles();
      s.subtitle.preset = 'pop';
      s.subtitle.bold = true;
      s.subtitle.primary_color = '#FFFFFF';
      s.subtitle.highlight_color = '#FFD23F';
      // Push captions below the boxed video.
      s.subtitle.margin_v = 80;
      s.title.font_color = '#FFFFFF';
      s.title.bg_color = '#000000';
      s.title.bg_opacity = 0;
      s.title.position = 'top';
      s.title.position_y = 10;
      s.title.font_size = 56;
      s.title.padding = 12;
      s.title.max_chars_per_line = 22;
      return s;
    },
  },
];

export function getPodcastTemplate(id: string): PodcastTemplate | undefined {
  return PODCAST_TEMPLATES.find((t) => t.id === id);
}
