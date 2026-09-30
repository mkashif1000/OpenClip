/**
 * Capture fixture, never imported by the production app.
 * All data and media are synthetic. The completed output state is seeded;
 * it is not evidence of a real transcription, LLM request, or OpenClip render.
 * QuickModeWorkspace and all of its children are the actual app components.
 */
import { createRoot } from 'react-dom/client';
import { QuickModeWorkspace } from '../src/components/quick/QuickModeWorkspace';
import { useProjectStore } from '../src/stores/projectStore';
import { useClipStore } from '../src/stores/clipStore';
import { useStyleStore } from '../src/stores/styleStore';
import { useProcessingStore } from '../src/stores/processingStore';
import { dbSaveProject, dbSaveClips, dbSaveStyles, dbRegisterFile } from '../src/services/db';
import { opfsWriteFile } from '../src/services/opfs';
import { getPodcastStyleConfig } from '../src/data/premadeTemplates';
import type { ClipData, Project, SubtitleEntry } from '../src/types';
import '../src/styles/globals.css';

const PROJECT_ID = 'openclip-workflow-capture';
const stage = new URLSearchParams(location.search).get('stage') ?? 'import';
const hasVideo = stage !== 'import';
const hasTranscript = !['import', 'transcript'].includes(stage);
const hasClips = ['brand', 'render', 'download'].includes(stage);

declare global {
  interface Window {
    workflowCapture: { ready: boolean; stage: string; synthetic: true; error?: string };
  }
}
window.workflowCapture = { ready: false, stage, synthetic: true };

function time(seconds: number) {
  return `00:${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')},000`;
}

const spokenLines = [
  'Start small.',
  'You do not need a perfect plan to begin creating.',
  'A small experiment teaches you what to try next.',
  'Make it useful.',
  'Listen to their questions and show your process.',
  'Simple, practical examples make your message memorable.',
  'Share the story.',
  'Turn one recording into a few clear, focused moments.',
  'Keep learning, keep making, and share the next chapter.',
];
const entries: SubtitleEntry[] = spokenLines.map((text, index) => ({
  start: time(index * 10), end: time((index + 1) * 10), text,
}));
const srt = entries.map((entry, index) => `${index + 1}\n${entry.start} --> ${entry.end}\n${entry.text}\n`).join('\n');

async function localMedia(name: string) {
  const response = await fetch(`/tests/fixtures/${name}`);
  if (!response.ok) throw new Error(`Missing local capture fixture: ${name}`);
  return response.blob();
}

async function storeFile(id: string, name: string, type: 'video' | 'srt' | 'music' | 'logo' | 'output', blob: Blob) {
  await opfsWriteFile(id, new File([blob], name, { type: blob.type }));
  await dbRegisterFile({ file_id: id, opfs_id: id, project_id: PROJECT_ID, filename: name, file_type: type, size_bytes: blob.size });
}

function syntheticAudio() {
  const samples = 8000;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, samples, true); view.setUint32(28, samples * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index++) {
    const envelope = Math.sin(Math.PI * index / samples) ** 2;
    view.setInt16(44 + index * 2, Math.round(Math.sin(index / samples * Math.PI * 2 * 220) * envelope * 1700), true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

async function syntheticLogo(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.beginPath(); context.roundRect(12, 12, 232, 232, 48); context.fill();
  context.fillStyle = '#111111'; context.font = 'bold 100px Arial';
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('OC', 128, 135);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Logo generation failed')), 'image/png'));
}

async function main() {
  const styles = getPodcastStyleConfig('pod_title_captions')!;
  styles.export = { ...styles.export, format: 'instagram_reels', width: 1080, height: 1920, face_tracking: false };
  const clips: ClipData[] = hasClips ? ['Start small', 'Make it useful', 'Share the story'].map((title, index) => ({
    clip_id: `workflow-clip-${index + 1}`, index: index + 1, title,
    start_time: index * 30, end_time: (index + 1) * 30, duration: 30,
    score: 94 - index * 3, preview_text: spokenLines[index * 3],
    entries: entries.slice(index * 3, index * 3 + 3),
    status: stage === 'download' ? 'completed' : 'pending',
    output_file: stage === 'download' ? `workflow-output-${index + 1}` : null,
  })) : [];
  const project: Project = {
    project_id: PROJECT_ID, name: 'The creative process', created_at: '2026-01-01T12:00:00.000Z',
    video_file: null, srt_file: null, json_file: null, clips, styles, status: 'idle',
  };
  if (hasVideo) {
    const video = await localMedia('workflow-source.mp4');
    await storeFile('workflow-source', 'creative-process.mp4', 'video', video);
    project.video_file = { file_id: 'workflow-source', path: 'workflow-source', filename: 'creative-process.mp4', file_type: 'video', size_bytes: video.size, duration: 90, width: 1280, height: 720, fps: 30 };
  }
  if (hasTranscript) {
    const transcript = new Blob([srt], { type: 'text/plain' });
    await storeFile('workflow-transcript', 'creative-process.srt', 'srt', transcript);
    project.srt_file = { file_id: 'workflow-transcript', path: 'workflow-transcript', filename: 'creative-process.srt', file_type: 'srt', size_bytes: transcript.size };
  }
  if (stage === 'brand') {
    await storeFile('workflow-music', 'ambient-demo.wav', 'music', syntheticAudio());
    await storeFile('workflow-logo', 'studio-logo.png', 'logo', await syntheticLogo());
    project.music_tracks = [{ path: 'workflow-music', filename: 'ambient-demo.wav', volume: .15, selected: true }];
    project.logo_config = { file_id: 'workflow-logo', filename: 'studio-logo.png', x: 85, y: 88, size: 12, opacity: 1 };
  }
  const outputBlobs: Record<string, Blob> = {};
  if (stage === 'download') {
    for (const clip of clips) {
      const output = await localMedia(`workflow-output-${clip.index}.mp4`);
      await storeFile(clip.output_file!, `${clip.title.toLowerCase().replaceAll(' ', '-')}.mp4`, 'output', output);
      outputBlobs[clip.clip_id] = output;
    }
  }
  await dbSaveProject(project);
  await dbSaveClips(PROJECT_ID, clips);
  await dbSaveStyles(PROJECT_ID, styles);
  await useProjectStore.getState().selectProject(PROJECT_ID);
  useClipStore.setState({ clips });
  useStyleStore.setState({ styles });
  useProcessingStore.setState({
    outputBlobs, isProcessing: false, clipProgress: {},
    completedClips: stage === 'download' ? clips.length : 0,
    failedClips: 0, totalClips: stage === 'download' ? clips.length : 0,
  });
  createRoot(document.getElementById('root')!).render(<QuickModeWorkspace />);
  window.workflowCapture.ready = true;
}

void main().catch((error: unknown) => {
  window.workflowCapture.error = error instanceof Error ? error.message : String(error);
  console.error('Workflow capture fixture failed:', error);
});
