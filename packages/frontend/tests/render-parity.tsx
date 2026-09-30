import { createRoot } from 'react-dom/client';
import { createRef } from 'react';
import { RemotionPreview, type PlayerRef } from '../src/components/player/RemotionPreview';
import { useStyleStore } from '../src/stores/styleStore';
import { renderFrame, type LayoutType } from '../src/services/canvasRenderer';
import { DEFAULT_SUBTITLE_STYLE, DEFAULT_TITLE_STYLE, DEFAULT_EXPORT, type ClipData } from '../src/types';
import { getBoxRect, getRegionRect, getSplitRegions } from '@viral-clipper/shared/rendering/geometry';
import { resolveTitleStyle, resolveSubtitleStyle } from '@viral-clipper/shared/rendering/overlays';
import '../src/styles/globals.css';
import { SUBTITLE_LOOKS } from '../src/data/subtitleLooks';
import { TITLE_LOOKS } from '../src/data/titleLooks';

const params = new URLSearchParams(location.search);
const layout = (params.get('layout') ?? 'standard') as LayoutType;
const width = Number(params.get('width') ?? 360);
const height = Number(params.get('height') ?? 640);
const frame = Number(params.get('frame') ?? 12);
const preset = (params.get('preset') ?? 'karaoke') as 'karaoke' | 'pop' | 'box' | 'minimal' | 'plain' | 'word';
const defaults = params.has('defaults');
const title = { ...DEFAULT_TITLE_STYLE, enabled: !params.has('hidden'), font_name: 'Arial', font_size: defaults ? null : 27,
  max_width: 83, position_y: 14, bg_opacity: params.has('transparent') ? 0 : 0.65,
  highlight_color: '#FFE030', accent_color: '#E75580' };
const subtitle = { ...DEFAULT_SUBTITLE_STYLE, preset, font_size: defaults ? null : 28,
  font_name: 'Arial', max_width: 76, margin_v: params.has('zero') ? 0 : 55,
  outline_width: params.has('zero') ? 0 : 3, bold: !params.has('normal') };
const titleLook = TITLE_LOOKS.find((l) => l.id === params.get('titleLook'));
if (titleLook) Object.assign(title, titleLook.style, { font_size: 27, position_y: 20 });
if (params.has('titleAdvanced')) Object.assign(title, { position_x: 60, rotation: 8, text_align: 'right',
  text_case: 'lower', letter_spacing: 2, line_height: 1.5, outline_width: 1.5, shadow_blur: 9,
  shadow_x: -3, shadow_y: 6, shadow_color: '#F53895' });
const look = SUBTITLE_LOOKS.find((l) => l.id === params.get('look'));
if (look) Object.assign(subtitle, look.style, { font_size: 28, margin_v: 70 });
if (params.has('advanced')) Object.assign(subtitle, {
  italic: true, text_case: 'original', position_x: 42, rotation: -12,
  text_align: params.get('align') ?? 'left', max_width: 65, letter_spacing: 1.5, line_height: 1.6,
  bg_color: '#3454BB', bg_opacity: 0.6, bg_padding: 12, bg_radius: 15,
  shadow_color: '#FC779D', shadow_blur: 9, shadow_x: 5, shadow_y: -3,
});
if (params.has('hidden')) Object.assign(subtitle, { enabled: false });
const exportSettings = { ...DEFAULT_EXPORT, width, height, box_width: 81, box_height: 47, box_y: 26, box_radius: 29 };
const styles = { title, subtitle, export: exportSettings };
useStyleStore.setState({ styles });
const clip: ClipData = {
  clip_id: 'fixture', index: 1, title: 'A colorful title that wraps cleanly', start_time: 2,
  end_time: 3.5, duration: 1.5, score: 1, preview_text: '', status: 'pending', output_file: null,
  entries: [{ start: '00:00:02,000', end: '00:00:03,500', text: 'Caption words wrap across multiple lines' }],
  edits: { titleColors: [0, 1, 2, 0, 1, 0, 2] },
};
const pipConfig = { contentBox: { x: 7, y: 9, width: 73, height: 66 },
  speakerBox: { x: 45, y: 21, width: 38, height: 67 }, splitRatio: 57 };
const regionCrops = params.has('custom')
  ? [{ x: 0.08, y: 0.12, w: 0.68, h: 0.75 }, { x: 0.48, y: 0.2, w: 0.35, h: 0.67 }]
  : undefined;
const split = ['split-2v', 'split-2h', 'split-3', 'split-4', 'gameplay'].includes(layout);
const splitRange = params.has('range') ? { start: 0.2, end: 0.6 } : null;
const logoSrc = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60"><rect width="180" height="60" fill="#e94199"/><circle cx="30" cy="30" r="22" fill="#ffff00"/></svg>')}`;
const logo = new Image(); logo.src = logoSrc;
const ref = createRef<PlayerRef>();
createRoot(document.getElementById('root')!).render(
  <div data-testid="preview" style={{ width, height }}>
    <RemotionPreview clip={clip} videoSegmentUrl="/tests/fixtures/grid.mp4" width={width} height={height}
      autoPlay={false} controls={false} loop={false} playerRef={ref}
      logoSrc={logoSrc} logoX={23} logoY={53} logoSize={24} logoOpacity={0.6}
      overridePip={layout === 'pip' || layout === 'hybrid' ? { ...pipConfig,
        ...(layout === 'hybrid' ? { pipStartSec: 0.2, pipEndSec: 0.6 } : {}) } : undefined}
      splitLayout={split ? layout as any : undefined} regionCrops={regionCrops} splitRange={splitRange}
      boxed={layout === 'boxed'} boxWidthPct={81} boxHeightPct={47} boxYPct={26} boxRadiusPx={29} />
  </div>,
);

// The test uses real preview video elements and the actual export renderer.
// Compare before H.264 compression, which intentionally changes pixels.
Object.assign(window, {
  fixture: { frame, sourceTime: clip.start_time + frame / 30, width, height },
  seek: () => ref.current?.seekTo(frame),
  geometry: { getBoxRect, getRegionRect, getSplitRegions, resolveTitleStyle, resolveSubtitleStyle },
  renderWorkerOverlay: async () => {
    await logo.decode();
    const blank = new OffscreenCanvas(640, 360);
    blank.getContext('2d');
    const video = blank.transferToImageBitmap();
    const logoImg = await createImageBitmap(logo);
    const worker = new Worker(new URL('./render-parity.worker.ts', import.meta.url), { type: 'module' });
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        worker.onerror = (e) => reject(new Error(e.message));
        worker.onmessage = (e) => e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.blob);
        worker.postMessage({ video, logoImg, clip, styleConfig: styles, width, height,
          currentTimeSec: clip.start_time + frame / 30, clipStartSec: clip.start_time,
          logoConfig: { x: 23, y: 53, size: 24, opacity: 0.6 } }, [video, logoImg]);
      });
      return await new Promise<string>((resolve) => { const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob); });
    } finally { worker.terminate(); }
  },
  renderExport: async (offscreen = false, overlaysOnly = false) => {
    await logo.decode();
    const video = document.querySelector('video')!;
    const canvas = offscreen ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const blank = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    blank.getContext('2d');
    const bitmap = overlaysOnly ? blank.transferToImageBitmap() : null;
    renderFrame({ video: bitmap ?? video, canvas, currentTimeSec: clip.start_time + frame / 30, clipStartSec: clip.start_time,
      clip, styleConfig: styles, width, height, logoImg: logo,
      logoConfig: { x: 23, y: 53, size: 24, opacity: 0.6 }, layoutType: layout,
      pipConfig: layout === 'pip' || layout === 'hybrid' ? pipConfig : undefined,
      pipStartSec: 0.2, pipEndSec: 0.6, regionCrops, layoutRange: splitRange });
    bitmap?.close();
    if (canvas instanceof HTMLCanvasElement) return canvas.toDataURL();
    const blob = await canvas.convertToBlob();
    return new Promise<string>((resolve) => { const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob); });
  },
});
