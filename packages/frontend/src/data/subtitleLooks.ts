import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle } from '@/types';

export interface SubtitleLook { id: string; name: string; category: 'Bold' | 'Clean' | 'Color' | 'Saved'; style: SubtitleStyle }
export const CAPTION_BASE: SubtitleStyle = {
  ...DEFAULT_SUBTITLE_STYLE, enabled: true, font_name: 'Arial', font_size: 58, preset: 'karaoke',
  text_case: 'upper', italic: false, letter_spacing: 0, line_height: 1.2, position_x: 50,
  rotation: 0, text_align: 'center', bg_color: '#111111', bg_opacity: 0, bg_padding: 14,
  bg_radius: 10, shadow_color: '#000000', shadow_blur: 0, shadow_x: 0, shadow_y: 0,
  active_text_color: '#FFFFFF', max_width: 88, margin_v: 180,
};
const look = (id: string, name: string, category: SubtitleLook['category'], patch: Partial<SubtitleStyle>): SubtitleLook =>
  ({ id, name, category, style: { ...CAPTION_BASE, ...patch } });

export const SUBTITLE_LOOKS: SubtitleLook[] = [
  look('classic', 'Classic Yellow', 'Bold', { highlight_color: '#FFE600' }),
  look('punch', 'Big Energy', 'Bold', { font_name: 'Impact', font_size: 70, preset: 'pop', highlight_color: '#B8FF60', outline_width: 5 }),
  look('paper', 'Paper White', 'Clean', { preset: 'plain', outline_width: 0, shadow_blur: 8, shadow_y: 3 }),
  look('mint', 'Mint Marker', 'Color', { preset: 'box', highlight_color: '#BEF264', active_text_color: '#18210E', outline_width: 2 }),
  look('cyan', 'Electric Cyan', 'Color', { preset: 'plain', primary_color: '#75F6FF', outline_width: 0, shadow_color: '#00C8FF', shadow_blur: 20 }),
  look('violet', 'Violet Glow', 'Color', { highlight_color: '#E4ADFF', outline_width: 1, shadow_color: '#C854FF', shadow_blur: 20 }),
  look('editorial', 'Editorial', 'Clean', { font_name: 'Georgia', bold: false, text_case: 'original', preset: 'plain', outline_width: 0, shadow_blur: 5, shadow_y: 2 }),
  look('red', 'Red Alert', 'Bold', { preset: 'box', highlight_color: '#F43F5E', font_name: 'Impact', outline_width: 0 }),
  look('film', 'Film Subtitles', 'Clean', { preset: 'minimal', font_size: 44, bold: false, text_case: 'original', bg_opacity: 0.7, bg_radius: 5, outline_width: 0 }),
  look('word', 'One at a Time', 'Bold', { preset: 'word', font_name: 'Impact', font_size: 76, highlight_color: '#FFD147', outline_width: 3 }),
  look('sunset', 'Sunset Pop', 'Color', { preset: 'pop', highlight_color: '#FF9871', shadow_color: '#492333', shadow_blur: 12 }),
  look('soft', 'Soft Spoken', 'Clean', { text_case: 'lower', bold: false, preset: 'plain', primary_color: '#F5E8D5', outline_width: 0, letter_spacing: 1, shadow_blur: 8 }),
  look('blue', 'Blue Label', 'Color', { preset: 'plain', bg_color: '#2456EC', bg_opacity: 0.95, bg_radius: 12, outline_width: 0 }),
  look('slant', 'In Motion', 'Bold', { font_name: 'Arial', italic: true, preset: 'pop', rotation: -4, highlight_color: '#FFE600', outline_width: 3 }),
  look('mono', 'Typewriter', 'Clean', { font_name: 'Courier New', text_case: 'original', bold: true, preset: 'plain', outline_width: 0, bg_opacity: 0.75, letter_spacing: 1 }),
  look('pink', 'Pink Spotlight', 'Color', { preset: 'box', highlight_color: '#EC72BB', active_text_color: '#251126', outline_width: 0 }),
];

export const SAVED_SUBTITLE_KEY = 'openclip:subtitle-presets:v1';
export function readSubtitleLooks(): SubtitleLook[] {
  try {
    const data = JSON.parse(localStorage.getItem(SAVED_SUBTITLE_KEY) ?? '[]');
    return Array.isArray(data) ? data.filter((p) => p?.id && p?.name && p?.style?.font_name).map((p) => ({ ...p, category: 'Saved' })) : [];
  } catch { return []; }
}
