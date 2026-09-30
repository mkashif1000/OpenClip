// Both workspaces resolve and preview templates through the same pipeline.
export {
  resolveTemplateChoice as resolveQuickStyle,
  mergeTemplateStyle as mergeQuickStyle,
  styleTemplateClip as styleQuickClip,
  type TemplateChoice as QuickStyleChoice,
} from '@/lib/templateSelection';
