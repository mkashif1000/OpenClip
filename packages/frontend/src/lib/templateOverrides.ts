/**
 * Per-template customizations, persisted in localStorage so they survive across
 * projects. When the user tweaks a podcast template in the drawer and clicks
 * "Save Settings", the customized look is stored here keyed by template id; the
 * next time that template's drawer opens (in ANY project) it seeds from the
 * saved values. "Reset to Default" clears the entry and reverts to the
 * template's built-in defaults.
 */
import type { SubtitleStyle, TitleStyle, CaptionPreset } from '@/types';

export interface TemplateOverride {
  subtitle: SubtitleStyle;
  title: TitleStyle;
  preset: CaptionPreset;
  /** Boxed-layout geometry (% of frame) + corner radius (output px). */
  box: { radius: number; width: number; height: number; y: number };
  /** Per-region source crops for split layouts (normalized [0,1], region order). */
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }>;
}

const KEY = 'openclip:template-overrides:v1';

function readAll(): Record<string, TemplateOverride> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, TemplateOverride>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, TemplateOverride>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage full / unavailable — non-fatal, the in-memory edit still applies */
  }
}

export function loadTemplateOverride(templateId: string): TemplateOverride | null {
  return readAll()[templateId] ?? null;
}

export function saveTemplateOverride(templateId: string, override: TemplateOverride): void {
  const map = readAll();
  map[templateId] = override;
  writeAll(map);
}

export function clearTemplateOverride(templateId: string): void {
  const map = readAll();
  delete map[templateId];
  writeAll(map);
}
