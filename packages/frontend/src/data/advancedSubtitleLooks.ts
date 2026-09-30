import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle } from '@/types';

export interface AdvancedSubtitleLook {
  id: string; name: string; description: string; category: 'Duo'; style: SubtitleStyle;
}
const duo = (id: string, name: string, description: string, patch: Partial<SubtitleStyle>): AdvancedSubtitleLook => ({
  id: `duo-${id}`, name, description, category: 'Duo',
  style: { ...DEFAULT_SUBTITLE_STYLE, enabled: true, preset: 'karaoke', font_name: 'Inter', font_size: 46,
    accent_font_name: 'Anton', accent_scale: 1.6, accent_bold: true, accent_italic: false,
    duo_emphasis: 'longest', duo_layout: 'inline', duo_effect: 'rise', text_case: 'upper', bold: false,
    primary_color: '#F6F6F6', highlight_color: '#D4FF70', active_text_color: '#121212',
    outline_color: '#111111', outline_width: 2, margin_v: 240, max_width: 86, line_height: 1.25,
    bg_opacity: 0, bg_color: '#111111', bg_padding: 12, bg_radius: 8, position_x: 50,
    text_align: 'center', rotation: 0, letter_spacing: 0, shadow_blur: 5,
    shadow_color: '#000000', shadow_x: 0, shadow_y: 2, ...patch },
});

/** 20 authored treatments. The accent word rule is deterministic, not semantic AI. */
export const ADVANCED_SUBTITLE_LOOKS: AdvancedSubtitleLook[] = [
  duo('headline', 'Headline Punch', 'Quiet sans meets oversized display. Elastic emphasis.', {
    duo_effect: 'bounce', accent_scale: 1.85, highlight_color: '#D4FF70', font_size: 42 }),
  duo('editorial', 'Editorial Muse', 'Bookish serif and sharp sans. A soft, stacked entrance.', {
    font_name: 'Georgia', accent_font_name: 'Montserrat', accent_scale: 1.45, text_case: 'original',
    duo_layout: 'stacked', duo_emphasis: 'last', highlight_color: '#F3D9AE', outline_width: 0 }),
  duo('neon', 'Neon Circuit', 'Monospaced setup, tall electric emphasis, breathing cyan light.', {
    font_name: 'Courier New', accent_font_name: 'Bebas Neue', duo_effect: 'glow', accent_scale: 1.9,
    highlight_color: '#62F9FF', shadow_color: '#00AECF', shadow_blur: 22, outline_width: 1 }),
  duo('paper', 'Paper Cut', 'Alternating serif and block letters with an ink marker wipe.', {
    font_name: 'Georgia', accent_font_name: 'Archivo Black', duo_effect: 'marker', duo_emphasis: 'alternate',
    text_case: 'original', highlight_color: '#F5EBCF', active_text_color: '#151515', accent_scale: 1.35, outline_width: 0 }),
  duo('velvet', 'Velvet Script', 'Italic serif emphasis over a fine sans. An understated underline.', {
    font_name: 'Poppins', accent_font_name: 'Georgia', accent_italic: true, accent_bold: false,
    duo_effect: 'underline', text_case: 'original', highlight_color: '#EDB8CF', accent_scale: 1.7, outline_width: 0 }),
  duo('comic', 'Comic Impact', 'Playful comic display with a tilted, oversized stamp.', {
    font_name: 'Trebuchet MS', accent_font_name: 'Bangers', duo_effect: 'stamp', duo_emphasis: 'last',
    accent_scale: 2, highlight_color: '#FFE252', rotation: -3, outline_width: 4, shadow_x: 4, shadow_y: 5 }),
  duo('terminal', 'Terminal Signal', 'Type-on monospace meets condensed display on a dark panel.', {
    font_name: 'Courier New', accent_font_name: 'Oswald', duo_effect: 'typewriter', duo_emphasis: 'alternate',
    text_case: 'lower', highlight_color: '#74FCA4', bg_opacity: 0.85, bg_color: '#061F15', bg_radius: 2, accent_scale: 1.4 }),
  duo('luxury', 'Gilded Cinema', 'Small sans, sweeping serif emphasis, gold on midnight.', {
    font_name: 'Barlow', accent_font_name: 'Times New Roman', accent_italic: true, duo_layout: 'stacked',
    duo_emphasis: 'last', duo_effect: 'glow', highlight_color: '#EBC779', shadow_color: '#8D601C',
    shadow_blur: 12, outline_width: 0, letter_spacing: 1, accent_scale: 2.1, font_size: 38 }),
  duo('sports', 'Fast Lane', 'Slanted condensed lettering with a punchy lateral entrance.', {
    font_name: 'Roboto', accent_font_name: 'Teko', italic: true, accent_italic: true,
    duo_effect: 'slide', highlight_color: '#FF7651', rotation: -4, accent_scale: 2, outline_width: 3 }),
  duo('outline', 'Outline Club', 'Hollow block lettering fills as the words become active.', {
    font_name: 'Montserrat', accent_font_name: 'Impact', duo_effect: 'outline', duo_emphasis: 'alternate',
    highlight_color: '#C4B0FF', accent_scale: 1.5, outline_width: 2, shadow_blur: 0 }),
  duo('echo', 'Chromatic Echo', 'Split-color type leaves a soft echo trail behind every beat.', {
    font_name: 'Rubik', accent_font_name: 'Bebas Neue', duo_effect: 'echo', duo_emphasis: 'alternate',
    highlight_color: '#FF4EBC', shadow_color: '#38D7FF', accent_scale: 1.7, outline_width: 1 }),
  duo('mint', 'Mint Marker', 'Friendly rounded base with an oversized mint active word.', {
    font_name: 'Poppins', accent_font_name: 'Archivo Black', duo_effect: 'marker', highlight_color: '#B8FFCF',
    active_text_color: '#0B2417', accent_scale: 1.55, outline_width: 0, bg_opacity: 0.15, bg_color: '#123D2B' }),
  duo('sunset', 'Sunset Bounce', 'Warm coral and cream with a lively bounce rhythm.', {
    font_name: 'Arial', accent_font_name: 'Bangers', duo_effect: 'bounce', highlight_color: '#FF9C70',
    shadow_color: '#8E2449', shadow_blur: 12, accent_scale: 1.8, outline_width: 2 }),
  duo('ice', 'Ice Breaker', 'Thin geometric captions with icy blue type-on emphasis.', {
    font_name: 'Barlow', accent_font_name: 'Teko', duo_effect: 'typewriter', highlight_color: '#A8E7FF',
    text_case: 'original', accent_scale: 1.95, outline_width: 0, letter_spacing: 1 }),
  duo('warning', 'Warning Label', 'Black-and-yellow alert card with a fast stamp entrance.', {
    font_name: 'Arial', accent_font_name: 'Impact', duo_effect: 'stamp', duo_emphasis: 'last',
    highlight_color: '#FFDB3D', active_text_color: '#161616', bg_color: '#171717', bg_opacity: 0.88,
    bg_radius: 3, accent_scale: 1.6, outline_width: 0 }),
  duo('rose', 'Rose Quartz', 'Elegant lowercase serif accent with a gentle rise.', {
    font_name: 'Inter', accent_font_name: 'Georgia', duo_effect: 'rise', duo_emphasis: 'longest',
    text_case: 'lower', highlight_color: '#FF9FCB', accent_italic: true, accent_bold: false,
    accent_scale: 1.8, outline_width: 0, shadow_blur: 14, shadow_color: '#C73F82' }),
  duo('pixel', 'Pixel Pop', 'Retro monospace rhythm with a sharp acid-green alternate.', {
    font_name: 'Courier New', accent_font_name: 'Teko', duo_effect: 'bounce', duo_emphasis: 'alternate',
    highlight_color: '#D0FF3F', accent_scale: 1.85, outline_width: 3, shadow_x: 3, shadow_y: 3,
    shadow_color: '#1E2C00' }),
  duo('midnight', 'Midnight Radio', 'Soft blue radio-card styling with a stacked reveal.', {
    font_name: 'Rubik', accent_font_name: 'Oswald', duo_layout: 'stacked', duo_effect: 'slide',
    duo_emphasis: 'last', highlight_color: '#8DA9FF', bg_color: '#111A42', bg_opacity: 0.8,
    bg_radius: 18, accent_scale: 1.6, outline_width: 0 }),
  duo('festival', 'Festival Glow', 'Wide party lettering, pink accent, and a saturated glow pulse.', {
    font_name: 'Montserrat', accent_font_name: 'Bangers', duo_effect: 'glow', duo_emphasis: 'alternate',
    highlight_color: '#FF62E7', shadow_color: '#823BFF', shadow_blur: 25, accent_scale: 1.9,
    outline_width: 2, rotation: 2 }),
  duo('minimal', 'Minimal Contrast', 'Quiet gray sans with a precise black display accent.', {
    font_name: 'Helvetica', accent_font_name: 'Times New Roman', duo_effect: 'underline', duo_emphasis: 'last',
    text_case: 'original', highlight_color: '#FFFFFF', bg_color: '#FFFFFF', bg_opacity: 0.12,
    accent_scale: 1.4, outline_width: 0, shadow_blur: 2 }),
];
