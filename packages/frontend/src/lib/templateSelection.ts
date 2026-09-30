import { getPodcastStyleConfig, getPodcastTemplate } from '@/data/premadeTemplates';
import { loadTemplateOverride } from '@/lib/templateOverrides';
import { autoTitleColors } from '@/lib/titleColors';
import type { ClipData, ClipEdits, StyleConfig, Template } from '@/types';

export interface TemplateChoice {
  id: string;
  name: string;
  layout: NonNullable<ClipEdits['layout']>;
  styles: StyleConfig;
  regionCrops?: Template['region_crops'];
  layoutRange?: Template['layout_range'];
  pipConfig?: Template['pip_config'];
}

export function resolveTemplateChoice(id: string, savedTemplates: Template[]): TemplateChoice | null {
  if (id.startsWith('saved:')) {
    const saved = savedTemplates.find((item) => `saved:${item.template_id}` === id);
    return saved ? {
      id, name: saved.name, styles: saved.styles, layout: saved.layout ?? 'standard',
      regionCrops: saved.region_crops, layoutRange: saved.layout_range, pipConfig: saved.pip_config,
    } : null;
  }
  const preset = getPodcastTemplate(id);
  const styles = getPodcastStyleConfig(id);
  const override = loadTemplateOverride(id);
  return preset && styles ? {
    id, name: preset.name, layout: preset.layout, styles,
    regionCrops: override?.regionCrops, layoutRange: override?.layoutRange,
  } : null;
}

/** Templates own visual geometry, never the user's encode/quality choices. */
export function mergeTemplateStyle(choice: TemplateChoice, current: StyleConfig): StyleConfig {
  return {
    subtitle: { ...choice.styles.subtitle },
    title: { ...choice.styles.title },
    export: {
      ...current.export,
      box_width: choice.styles.export.box_width,
      box_height: choice.styles.export.box_height,
      box_y: choice.styles.export.box_y,
      box_radius: choice.styles.export.box_radius,
    },
  };
}

/** Same transformation for preview and apply; never erase a custom headline. */
export function styleTemplateClip(clip: ClipData, choice: TemplateChoice): ClipData {
  const edits: ClipEdits = {
    ...clip.edits,
    layout: choice.layout,
    layoutRange: choice.layoutRange ?? null,
    regionCrops: choice.regionCrops,
    pipConfig: choice.pipConfig,
    titleFont: undefined,
  };
  // Repair the empty-title marker left by older Quick Mode's caption-only presets.
  if (edits.customTitle === '') delete edits.customTitle;
  edits.titleColors = autoTitleColors(edits.customTitle ?? clip.title);
  return { ...clip, edits };
}
