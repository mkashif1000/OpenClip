import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QuickModeWorkspace } from '../src/components/quick/QuickModeWorkspace';
import { useProjectStore } from '../src/stores/projectStore';
import { useClipStore } from '../src/stores/clipStore';
import { useStyleStore } from '../src/stores/styleStore';
import { useClipTemplateStore } from '../src/stores/clipTemplateStore';
import { dbSaveClips, dbSaveStyles, dbSaveTemplate, dbGetProject } from '../src/services/db';
import { getPodcastStyleConfig } from '../src/data/premadeTemplates';
import type { ClipData } from '../src/types';
import '../src/styles/globals.css';

async function main() {
  const project = await useProjectStore.getState().createProject('Quick test');
  const video = await (await fetch('/tests/fixtures/grid.mp4')).blob();
  await useProjectStore.getState().setFile('video', new File([video], 'grid.mp4', { type: 'video/mp4' }));
  await useProjectStore.getState().setFile('srt', new File(['1\n00:00:00,000 --> 00:00:04,000\nMake every word worth watching.\n'], 'transcript.srt', { type: 'text/plain' }));
  const clip: ClipData = {
    clip_id: 'quick-one', index: 1, title: 'Make every word matter', start_time: 0, end_time: 4, duration: 4,
    score: 80, preview_text: 'Make every word worth watching.', status: 'pending', output_file: null,
    entries: [{ start: '00:00:00,000', end: '00:00:04,000', text: 'Make every word worth watching.' }],
    edits: { customTitle: 'My custom headline', titleFont: 'Impact', layout: 'split-2v', cutRanges: [{ start: 1, end: 1.2 }] },
  };
  const clips = [clip, { ...clip, clip_id: 'quick-two', index: 2, title: 'Second clip', edits: { customTitle: '' } }];
  await dbSaveClips(project.project_id, clips);
  const styles = getPodcastStyleConfig('pod_title_captions')!;
  styles.export = { ...styles.export, format: 'instagram_reels', width: 1080, height: 1920, crf: 18, face_tracking: false };
  await dbSaveStyles(project.project_id, styles);
  const saved = getPodcastStyleConfig('creator_newsbar')!;
  saved.export.box_width = 76;
  await dbSaveTemplate({ template_id: 'saved-box', name: 'Saved Brand', description: 'My saved boxed look', styles: saved, layout: 'boxed' });
  await dbSaveTemplate({ template_id: 'saved-split', name: 'Saved Split', description: '', styles: saved, layout: 'split-2h', region_crops: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }], layout_range: { start: 0, end: 3 } });
  // Deliberately leave project.clips stale: mounting Quick Mode must read the
  // persisted collection without overwriting it with the empty project array.
  useClipStore.setState({ clips });
  useStyleStore.setState({ styles });
  useClipTemplateStore.getState().setClipTemplate(clip.clip_id, 'creator_neon');
  Object.assign(window, { quickTest: {
    renameProject: (name: string) => useProjectStore.getState().renameProject(project.project_id, name),
    saved: () => dbGetProject(project.project_id),
    state: () => ({ styles: useStyleStore.getState().styles, clips: useClipStore.getState().clips, assignments: useClipTemplateStore.getState().assignments }),
  } });
  createRoot(document.getElementById('root')!).render(<StrictMode><QuickModeWorkspace /></StrictMode>);
}
void main();
