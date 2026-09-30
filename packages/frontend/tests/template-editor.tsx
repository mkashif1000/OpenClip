import { createRoot } from 'react-dom/client';
import { StyleTab } from '../src/components/tabs/StyleTab';
import { DashboardTab } from '../src/components/tabs/DashboardTab';
import { Header } from '../src/components/layout/Header';
import { useProjectStore } from '../src/stores/projectStore';
import { useClipStore } from '../src/stores/clipStore';
import { useStyleStore } from '../src/stores/styleStore';
import { useUIStore } from '../src/stores/uiStore';
import { dbSaveClips, dbGetTemplates, dbGetStyles, dbGetClips } from '../src/services/db';
import type { ClipData } from '../src/types';
import '../src/styles/globals.css';

async function main() {
  const project = await useProjectStore.getState().createProject('Studio test');
  if (!location.search.includes('sample')) {
    const blob = await (await fetch('/tests/fixtures/grid.mp4')).blob();
    await useProjectStore.getState().setFile('video', new File([blob], 'grid.mp4', { type: 'video/mp4' }));
    const clip: ClipData = { clip_id: 'studio-clip', index: 1, title: 'Make every word matter',
      start_time: 0, end_time: 4, duration: 4, score: 1, preview_text: '', status: 'pending', output_file: null,
      entries: [{ start: '00:00:00', end: '00:00:04', text: 'Make every word worth watching' }] };
    const clips = [clip, { ...clip, clip_id: 'studio-clip-2', index: 2, title: 'The next story' }];
    await dbSaveClips(project.project_id, clips);
    useClipStore.setState({ clips });
  }
  useStyleStore.getState().setTitleStyle({ font_name: 'Arial' });
  useStyleStore.getState().setExportSettings({ format: 'vertical', width: 720, height: 1280 });
  useUIStore.getState().setActiveTab(location.search.includes('dashboard') ? 'dashboard' : 'style');
  Object.assign(window, { studio: {
    state: () => ({ styles: useStyleStore.getState().styles, clips: useClipStore.getState().clips }),
    saved: async () => ({ templates: await dbGetTemplates(), styles: await dbGetStyles(project.project_id), clips: await dbGetClips(project.project_id) }),
  } });
  function App() {
    const tab = useUIStore((s) => s.activeTab);
    return <><Header />{tab === 'dashboard' ? <DashboardTab /> : <StyleTab />}</>;
  }
  createRoot(document.getElementById('root')!).render(<App />);
}
void main();
