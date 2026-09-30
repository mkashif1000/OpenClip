import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ImportTab } from '../src/components/tabs/ImportTab';
import { useProjectStore } from '../src/stores/projectStore';
import { useClipStore } from '../src/stores/clipStore';
import { useStyleStore } from '../src/stores/styleStore';
import { useUIStore } from '../src/stores/uiStore';
import { useProcessingStore } from '../src/stores/processingStore';
import { useClipTemplateStore } from '../src/stores/clipTemplateStore';
import { dbApplyTemplate, dbGetProject, dbSaveClips, dbSaveStyles, dbSaveTemplate } from '../src/services/db';
import { getPodcastStyleConfig, PODCAST_TEMPLATES } from '../src/data/premadeTemplates';
import { OpfsQuotaError } from '../src/services/opfs';
import type { ClipData, Template } from '../src/types';
import '../src/styles/globals.css';

async function main() {
  const project = await useProjectStore.getState().createProject('Import template test');
  const video = await (await fetch('/tests/fixtures/grid.mp4')).blob();
  await useProjectStore.getState().setFile('video', new File([video], 'grid.mp4', { type: 'video/mp4' }));
  await useProjectStore.getState().setFile('srt', new File(['1\n00:00:00,000 --> 00:00:04,000\nMake every word worth watching.\n'], 'transcript.srt', { type: 'text/plain' }));
  const clip: ClipData = {
    clip_id: 'import-one', index: 1, title: 'First clip', start_time: 0, end_time: 4, duration: 4,
    score: 80, preview_text: 'Make every word worth watching.', status: 'pending', output_file: null,
    entries: [{ start: '00:00:00,000', end: '00:00:04,000', text: 'Make every word worth watching.' }],
    edits: { customTitle: 'Keep my custom headline', titleFont: 'Impact', layout: 'standard', cutRanges: [{ start: 1, end: 1.2 }] },
  };
  const clips = [clip, { ...clip, clip_id: 'import-two', index: 2, title: 'Second clip', edits: { customTitle: 'Second custom headline' } }];
  const styles = getPodcastStyleConfig('pod_title_captions')!;
  styles.export = { ...styles.export, width: 1080, height: 1920, crf: 18, face_tracking: false };
  await dbSaveClips(project.project_id, clips);
  await dbSaveStyles(project.project_id, styles);
  const savedStyles = getPodcastStyleConfig('pod_boxed_video')!;
  savedStyles.export.box_width = 64;
  savedStyles.subtitle.primary_color = '#00FF00';
  savedStyles.subtitle.preset = 'minimal';
  savedStyles.title.font_color = '#FF00FF';
  const templates: Template[] = [
    { template_id: 'saved-box', name: 'Saved Brand', description: '', styles: savedStyles, layout: 'boxed' },
    { template_id: 'saved-split', name: 'Saved Split', description: '', styles: savedStyles, layout: 'split-2h', region_crops: [{ x: 0, y: 0, w: .5, h: 1 }, { x: .5, y: 0, w: .5, h: 1 }], layout_range: { start: 0, end: 3 } },
    { template_id: 'saved-pip', name: 'Saved PIP', description: '', styles: savedStyles, layout: 'pip', pip_config: { contentBox: { x: 0, y: 0, width: .7, height: 1 }, speakerBox: { x: .7, y: 0, width: .3, height: 1 }, splitRatio: .6 } },
  ];
  for (const template of templates) await dbSaveTemplate(template);
  useClipStore.setState({ clips });
  useStyleStore.setState({ styles });
  useUIStore.setState({ workspaceMode: 'advanced' });
  useClipTemplateStore.getState().setClipTemplate(clip.clip_id, 'creator_neon');
  const sourceVideo = useProjectStore.getState().currentProject!.video_file;
  const originalSetFile = useProjectStore.getState().setFile;
  let importCalls = 0;
  let releaseImport: (() => void) | null = null;
  Object.assign(window, { importTest: {
    emptyProject: async () => {
      const next = await useProjectStore.getState().createProject('Fresh import');
      useClipStore.setState({ clips: [] });
      useStyleStore.setState({ styles: next.styles });
    },
    // Test-only instrumentation: record writes and exercise busy/quota UI.
    watchImports: (behavior: 'normal' | 'paused' | 'quota' = 'normal') => {
      importCalls = 0;
      useProjectStore.setState({ setFile: async (type, file, progress) => {
        importCalls += 1;
        if (behavior === 'quota') throw new OpfsQuotaError(file.size, 1024 ** 3, 2 * 1024 ** 3);
        if (behavior === 'paused') {
          progress?.(37);
          await new Promise<void>(resolve => { releaseImport = resolve; });
        }
        await originalSetFile(type, file, progress);
      } });
    },
    importCalls: () => importCalls,
    releaseImport: () => { releaseImport?.(); releaseImport = null; },
    presetCount: PODCAST_TEMPLATES.length,
    saved: () => dbGetProject(project.project_id),
    state: () => ({ styles: useStyleStore.getState().styles, clips: useClipStore.getState().clips, assignments: useClipTemplateStore.getState().assignments }),
    clearClips: () => useClipStore.getState().setClips([]),
    editTitle: () => useClipStore.getState().updateClip(clip.clip_id, { edits: { ...useClipStore.getState().clips[0].edits, customTitle: 'Freshly edited headline' } }),
    addSaved: () => dbSaveTemplate({ ...templates[0], template_id: 'new-template', name: 'New Saved Look' }),
    processing: (isProcessing: boolean) => useProcessingStore.setState({ isProcessing }),
    switchProject: async () => {
      const next = await useProjectStore.getState().createProject('Other project');
      await useProjectStore.getState().updateCurrentProject({ video_file: sourceVideo });
      useClipStore.setState({ clips: [] });
      useStyleStore.setState({ styles: next.styles });
    },
    failTransaction: () => dbApplyTemplate(project.project_id, savedStyles, [{ clip_id: clip.clip_id, edits: { layout: 'boxed' } }, { clip_id: 'missing', edits: {} }]).catch(() => 'aborted'),
  } });
  createRoot(document.getElementById('root')!).render(<StrictMode><ImportTab /></StrictMode>);
}
void main();
