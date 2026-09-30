import { resolveSubtitleStyle } from './overlays';
import type { DuoCaptionConfig } from './duoConfig';

export interface SubtitleConfig extends DuoCaptionConfig {
  enabled?: boolean;
  italic?: boolean;
  text_case?: 'upper' | 'lower' | 'original';
  letter_spacing?: number;
  line_height?: number;
  position_x?: number;
  rotation?: number;
  text_align?: 'left' | 'center' | 'right';
  bg_color?: string;
  bg_opacity?: number;
  bg_padding?: number;
  bg_radius?: number;
  shadow_color?: string;
  shadow_blur?: number;
  shadow_x?: number;
  shadow_y?: number;
  active_text_color?: string;
  font_name: string;
  font_size: number | null;
  bold: boolean;
  primary_color: string;
  highlight_color: string;
  outline_color: string;
  outline_width: number;
  position: string;
  margin_v: number | null;
  /** Max caption width as a % of frame width (controls wrapping). */
  max_width?: number;
  preset?: string;
}

/** One adapter for persisted styles, used by preview, galleries and export. */
export function subtitleStyleFromConfig(style: SubtitleConfig, width: number, height: number) {
  return resolveSubtitleStyle({
    accent_font_name: style.accent_font_name,
    accent_scale: style.accent_scale,
    accent_bold: style.accent_bold,
    accent_italic: style.accent_italic,
    duo_emphasis: style.duo_emphasis,
    duo_layout: style.duo_layout,
    duo_effect: style.duo_effect,
    enabled: style.enabled,
    italic: style.italic,
    textCase: style.text_case,
    letterSpacing: style.letter_spacing,
    lineHeight: style.line_height,
    positionX: style.position_x,
    rotation: style.rotation,
    textAlign: style.text_align,
    bgColor: style.bg_color,
    bgOpacity: style.bg_opacity,
    bgPadding: style.bg_padding,
    bgRadius: style.bg_radius,
    shadowColor: style.shadow_color,
    shadowBlur: style.shadow_blur,
    shadowX: style.shadow_x,
    shadowY: style.shadow_y,
    activeTextColor: style.active_text_color,
    primaryColor: style.primary_color,
    highlightColor: style.highlight_color,
    outlineColor: style.outline_color,
    outlineWidth: style.outline_width,
    fontSize: style.font_size ?? undefined,
    fontName: style.font_name,
    bold: style.bold,
    marginV: style.margin_v ?? undefined,
    maxWidthPct: style.max_width,
    preset: style.preset,
  }, width, height);
}
