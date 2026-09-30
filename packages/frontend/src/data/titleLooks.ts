import { DEFAULT_TITLE_STYLE, type TitleStyle } from '@/types';

export interface TitleLook { id: string; name: string; category: 'Bold' | 'Clean' | 'Color' | 'Saved'; style: TitleStyle }
const TITLE_BASE: TitleStyle = {
  ...DEFAULT_TITLE_STYLE, enabled: true, font_name: 'Arial', font_size: 48,
  bold: true, italic: false, text_case: 'original', font_color: '#FFFFFF',
  highlight_color: '#BEF264', accent_color: '#FFFFFF', bg_color: '#111111', bg_opacity: 0,
  padding: 18, border_radius: 10, position_y: 12, position_x: 50, max_width: 86,
  rotation: 0, text_align: 'center', letter_spacing: 0, line_height: 1.2,
  outline_color: '#000000', outline_width: 0, shadow_color: '#000000', shadow_blur: 6, shadow_x: 0, shadow_y: 2,
};
const look = (id: string, name: string, category: TitleLook['category'], patch: Partial<TitleStyle>): TitleLook =>
  ({ id, name, category, style: { ...TITLE_BASE, ...patch } });

export const TITLE_LOOKS: TitleLook[] = [
  look('headline', 'Signature Headline', 'Bold', { bg_opacity: 0.8 }),
  look('newsroom', 'Newsroom', 'Bold', { font_name: 'Impact', text_case: 'upper', highlight_color: '#FF4D57', font_size: 58 }),
  look('editorial', 'Editorial Serif', 'Clean', { font_name: 'Georgia', bold: false, highlight_color: '#FFFFFF', font_size: 46 }),
  look('violet', 'Violet Neon', 'Color', { highlight_color: '#EDBFFF', accent_color: '#EDBFFF', shadow_color: '#CA4DFF', shadow_blur: 24, shadow_y: 0 }),
  look('electric', 'Electric Headline', 'Color', { font_name: 'Impact', text_case: 'upper', font_color: '#75F6FF', highlight_color: '#FFFFFF', shadow_color: '#00ADFF', shadow_blur: 16 }),
  look('yellow', 'Yellow Label', 'Bold', { font_name: 'Impact', text_case: 'upper', font_color: '#181818', highlight_color: '#181818', accent_color: '#181818', bg_color: '#FFE34D', bg_opacity: 1, border_radius: 4, shadow_blur: 0, shadow_y: 0 }),
  look('red', 'Breaking Red', 'Bold', { text_case: 'upper', highlight_color: '#FFFFFF', bg_color: '#E92D42', bg_opacity: 1, border_radius: 0, shadow_blur: 0, shadow_y: 0 }),
  look('white', 'Quiet White', 'Clean', { bold: false, highlight_color: '#FFFFFF', font_size: 42, letter_spacing: 1 }),
  look('paper', 'Paper Card', 'Clean', { font_name: 'Georgia', font_color: '#28231D', highlight_color: '#A95125', accent_color: '#28231D', bg_color: '#F5EDDD', bg_opacity: 1, shadow_blur: 0, shadow_y: 0, border_radius: 4, padding: 24 }),
  look('rose', 'Soft Rose', 'Color', { font_color: '#5D2545', highlight_color: '#A3296B', accent_color: '#5D2545', bg_color: '#FFDBEF', bg_opacity: 1, border_radius: 24, shadow_blur: 0, shadow_y: 0 }),
  look('mono', 'Typewriter Title', 'Clean', { font_name: 'Courier New', highlight_color: '#FFFFFF', bg_opacity: 0.85, border_radius: 0, letter_spacing: 1, font_size: 42 }),
  look('midnight', 'Midnight Blue', 'Color', { bg_color: '#122345', bg_opacity: 0.95, highlight_color: '#6DCBFF', border_radius: 14, padding: 24 }),
  look('outline', 'Bold Outline', 'Bold', { font_name: 'Impact', text_case: 'upper', outline_width: 4, highlight_color: '#FFBE62', font_size: 58, shadow_blur: 0 }),
  look('purple', 'Purple Pop', 'Color', { bg_color: '#6939C6', bg_opacity: 1, highlight_color: '#FFF278', border_radius: 28, rotation: -3, padding: 24, shadow_blur: 0, shadow_y: 0 }),
  look('cinema', 'Cinema Gold', 'Clean', { font_name: 'Georgia', italic: true, bold: false, font_color: '#F5DFB0', highlight_color: '#F5DFB0', accent_color: '#F5DFB0', letter_spacing: 0.5, shadow_blur: 8, font_size: 46 }),
];

export const SAVED_TITLE_KEY = 'openclip:title-presets:v1';
export function readTitleLooks(): TitleLook[] {
  try {
    const data = JSON.parse(localStorage.getItem(SAVED_TITLE_KEY) ?? '[]');
    return Array.isArray(data) ? data.filter((p) => p?.id && p?.name && p?.style?.font_name).map((p) => ({ ...p, category: 'Saved' })) : [];
  } catch { return []; }
}
