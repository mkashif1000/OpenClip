import { useEffect, useRef } from 'react';
import { renderFrame } from '@/services/canvasRenderer';
import { ensureFontsLoaded } from '@/services/fontLoader';
import type { ClipData, StyleConfig } from '@/types';
import type { PodcastTemplate } from '@/data/premadeTemplates';

export function TemplateSample({ styles, title, colors, layout, width, height }: {
  styles: StyleConfig; title: string; colors: number[]; layout: PodcastTemplate['layout']; width: number; height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    let bitmap: ImageBitmap | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const background = new OffscreenCanvas(1280, 720);
    const ctx = background.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
    gradient.addColorStop(0, '#283C39'); gradient.addColorStop(0.5, '#48585B'); gradient.addColorStop(1, '#12191E');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#748778'; ctx.beginPath(); ctx.arc(640, 380, 180, 0, Math.PI * 2); ctx.fill();
    const clip: ClipData = { clip_id: 'sample', index: 1, title, start_time: 0, end_time: 4, duration: 4,
      score: 0, preview_text: '', status: 'pending', output_file: null, edits: { titleColors: colors },
      entries: [{ start: '00:00:00', end: '00:00:04', text: 'Make every word worth watching' }] };
    void (async () => {
      await ensureFontsLoaded([styles.subtitle.font_name, styles.title.font_name ?? 'Inter']);
      if (disposed) return;
      bitmap = background.transferToImageBitmap();
      const start = performance.now();
      const paint = () => { if (!disposed && bitmap && ref.current) renderFrame({ video: bitmap, canvas: ref.current,
        clip, styleConfig: styles, currentTimeSec: ((performance.now() - start) / 1000) % 4,
        clipStartSec: 0, width, height, layoutType: layout }); };
      paint(); timer = setInterval(paint, 100);
    })();
    return () => { disposed = true; if (timer) clearInterval(timer); bitmap?.close(); };
  }, [styles, title, colors, layout, width, height]);
  return <canvas ref={ref} width={width} height={height} aria-label="Sample template preview" className="w-full h-full" />;
}
