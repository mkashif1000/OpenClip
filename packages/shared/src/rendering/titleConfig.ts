import { resolveTitleStyle } from './overlays';

export interface TitleConfig {
  enabled?: boolean; bold?: boolean; italic?: boolean;
  text_case?: 'upper' | 'lower' | 'original';
  letter_spacing?: number; line_height?: number; position_x?: number; rotation?: number;
  text_align?: 'left' | 'center' | 'right';
  outline_color?: string; outline_width?: number;
  shadow_color?: string; shadow_blur?: number; shadow_x?: number; shadow_y?: number;
  font_size: number | null; font_color: string; font_name?: string;
  bg_color: string; bg_opacity: number; padding: number; position: string;
  position_y?: number; border_radius?: number; max_chars_per_line: number | null;
  highlight_color?: string; accent_color?: string; max_width?: number;
}

/** Keep title presets and custom typography identical in preview and export. */
export function titleStyleFromConfig(style: TitleConfig, width: number, height: number, wordColors?: number[]) {
  return resolveTitleStyle({
    enabled: style.enabled, bold: style.bold, italic: style.italic, textCase: style.text_case,
    letterSpacing: style.letter_spacing, lineHeight: style.line_height,
    positionX: style.position_x, rotation: style.rotation, textAlign: style.text_align,
    outlineColor: style.outline_color, outlineWidth: style.outline_width,
    shadowColor: style.shadow_color, shadowBlur: style.shadow_blur, shadowX: style.shadow_x, shadowY: style.shadow_y,
    fontSize: style.font_size ?? undefined, fontColor: style.font_color, fontName: style.font_name,
    bgColor: style.bg_color, bgOpacity: style.bg_opacity, padding: style.padding,
    position: style.position as 'top' | 'center' | 'bottom', positionY: style.position_y,
    borderRadius: style.border_radius, maxCharsPerLine: style.max_chars_per_line ?? undefined,
    maxWidthPct: style.max_width, highlightColor: style.highlight_color, accentColor: style.accent_color, wordColors,
  }, width, height);
}
