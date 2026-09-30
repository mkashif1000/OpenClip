// Synthetic rendering + actual Process controls. No real face-accuracy claims.
import { createRoot } from 'react-dom/client';
import { ProcessingPanel } from '../src/components/processing/ProcessingPanel';
import { useProjectStore } from '../src/stores/projectStore';
import { useStyleStore } from '../src/stores/styleStore';
import { useProcessingStore } from '../src/stores/processingStore';
import { dbSaveProject, dbGetStyles } from '../src/services/db';
import { renderFrame } from '../src/services/canvasRenderer';
import { buildAutoSplitCrops } from '../src/services/autoSplitPolicy';
import { analyzeScreenShareFrame } from '../src/services/screenSharePolicy';
import { detectScreenShareFaces } from '../src/services/screenShareDetector';
import { getFaceDetector } from '../src/services/faceTracker';
import { DEFAULT_EXPORT, DEFAULT_SUBTITLE_STYLE, DEFAULT_TITLE_STYLE, type ClipData, type Project } from '../src/types';
import '../src/styles/globals.css';

const id = 'auto-split-test';
const clip: ClipData = { clip_id: 'synthetic', index: 1, title: '', start_time: 0, end_time: 2,
  duration: 2, score: 1, preview_text: '', status: 'pending', output_file: null,
  entries: [{ start: '00:00:00,000', end: '00:00:02,000', text: 'everyone' }] };

function render(options: { split?: boolean; center?: boolean; duo?: boolean; enabled?: boolean;
  mismatch?: boolean; offscreen?: boolean; text?: string } = {}) {
  const { split = true, center = true, duo = false, enabled = true, mismatch = false, offscreen = false } = options;
  const source = new OffscreenCanvas(768, 432);
  const sc = source.getContext('2d')!;
  sc.fillStyle = 'rgb(180,20,20)'; sc.fillRect(0, 0, 384, 432);
  sc.fillStyle = 'rgb(20,40,180)'; sc.fillRect(384, 0, 384, 432);
  const frame = new VideoFrame(source, { timestamp: 1000000 });
  const canvas = offscreen ? new OffscreenCanvas(360, 640) : document.createElement('canvas');
  canvas.width = 360; canvas.height = 640;
  const styles = { export: { ...DEFAULT_EXPORT, auto_split_faces: true, auto_split_center_captions: center },
    title: { ...DEFAULT_TITLE_STYLE }, subtitle: { ...DEFAULT_SUBTITLE_STYLE, enabled,
      font_name: 'Arial', font_size: 28, margin_v: 45, max_width: 76, preset: 'plain' as const,
      primary_color: '#FFFFFF', highlight_color: '#FFFFFF', outline_width: 0,
      shadow_blur: 0, shadow_x: 0, shadow_y: 0, bg_opacity: 0,
      ...(duo ? { accent_font_name: 'Arial', accent_scale: 1.5, duo_effect: 'rise' as const } : {}) } };
  const before = JSON.stringify(styles);
  const crops = buildAutoSplitCrops([
    { x: 125 / 768, y: 115 / 432, w: 85 / 768, h: 85 / 432, confidence: .96 },
    { x: 540 / 768, y: 115 / 432, w: 85 / 768, h: 85 / 432, confidence: .96 },
  ], 768, 432, 360, 640)!;
  renderFrame({ video: frame, canvas, currentTimeSec: 1, clipStartSec: 0,
    clip: { ...clip, entries: [{ ...clip.entries[0], text: options.text ?? 'everyone' }] },
    styleConfig: styles, width: 360, height: 640,
    autoSplitFrame: split ? { sourceTimestampUs: mismatch ? 999999 : 1000000, crops } : null });
  frame.close();
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const data = ctx.getImageData(0, 0, 360, 640).data;
  let top = Infinity, bottom = -Infinity;
  for (let y = 0; y < 640; y++) for (let x = 0; x < 360; x++) {
    const i = (y * 360 + x) * 4;
    if (data[i] > 210 && data[i + 1] > 210 && data[i + 2] > 210) {
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  const pixel = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
  return { captionCenter: Number.isFinite(top) ? (top + bottom) / 2 : null,
    top: pixel(80, 80), bottom: pixel(80, 560), unchanged: before === JSON.stringify(styles) };
}

// Opt-in local reference: the test supplies the image route, never bundles it.
async function reference(url: string) {
  const image = new Image(); image.src = url; await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = Math.round(image.height * 768 / image.width);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const detector = await getFaceDetector();
  const detections = detectScreenShareFaces(detector, canvas, canvas.width, canvas.height,
    document.createElement('canvas'), detector.detect(canvas).detections);
  const result = analyzeScreenShareFrame({ detections, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width, height: canvas.height, sourceWidth: image.width, sourceHeight: image.height,
    outputWidth: 720, outputHeight: 1280 });
  let preview: string | null = null;
  if (result) {
    const full = document.createElement('canvas'); full.width = image.width; full.height = image.height;
    full.getContext('2d')!.drawImage(image, 0, 0);
    const frame = new VideoFrame(full, { timestamp: 1000000 });
    const output = document.createElement('canvas'); output.width = 720; output.height = 1280;
    renderFrame({ video: frame, canvas: output, currentTimeSec: 1, clipStartSec: 0, clip,
      styleConfig: { export: { ...DEFAULT_EXPORT, auto_split_screen_share: true, auto_split_faces: false },
        subtitle: { ...DEFAULT_SUBTITLE_STYLE, enabled: false }, title: { ...DEFAULT_TITLE_STYLE } },
      width: 720, height: 1280, autoSplitFrame: { ...result, kind: 'screen-share', sourceTimestampUs: 1000000 } });
    frame.close(); preview = output.toDataURL('image/png');
  }
  return { detections, result, preview };
}

async function main() {
  const styles = { export: { ...DEFAULT_EXPORT, face_tracking: false },
    subtitle: { ...DEFAULT_SUBTITLE_STYLE }, title: { ...DEFAULT_TITLE_STYLE } };
  const project: Project = { project_id: id, name: 'Split controls test', created_at: '2026-01-01',
    video_file: null, srt_file: null, json_file: null, clips: [], styles, status: 'idle' };
  await dbSaveProject(project);
  await useProjectStore.getState().selectProject(id);
  useProjectStore.setState({ currentProject: { ...project, video_file: {
    file_id: 'synthetic', filename: 'synthetic.mp4', file_type: 'video', path: 'synthetic', size_bytes: 0,
  } } });
  useStyleStore.setState({ styles });
  createRoot(document.getElementById('root')!).render(<ProcessingPanel />);
  Object.assign(window, { splitFixture: { render, reference,
    settings: () => useStyleStore.getState().styles.export,
    saved: async () => (await dbGetStyles(id)).export,
    processing: (value: boolean) => useProcessingStore.setState({ isProcessing: value }),
  } });
}
void main();
