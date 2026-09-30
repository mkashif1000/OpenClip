import { useEffect, useRef } from 'react';
import { drawSubtitleOverlay } from '@viral-clipper/shared/rendering/overlays';
import { subtitleStyleFromConfig } from '@viral-clipper/shared/rendering/subtitleConfig';
import { ensureFontsLoaded } from '@/services/fontLoader';
import type { SubtitleStyle } from '@/types';

export function CaptionSwatch({ style, animated = false }: { style: SubtitleStyle; animated?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let lastPaint = 0;
    let visible = true;
    const canvas = canvasRef.current;
    const observer = animated && typeof IntersectionObserver !== 'undefined' && canvas
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; })
      : undefined;
    observer?.observe(canvas);

    const draw = (timeSec: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || cancelled) return;
      ctx.clearRect(0, 0, 280, 150);
      drawSubtitleOverlay(ctx, [{ start: '00:00:00', end: '00:00:03', text: 'Make words matter' }], timeSec, 0,
        subtitleStyleFromConfig({ ...style, enabled: true, font_size: 30, margin_v: 45, position_x: 50,
          max_width: 90, outline_width: style.outline_width * 0.5, shadow_blur: (style.shadow_blur ?? 0) * 0.5,
          bg_padding: (style.bg_padding ?? 12) * 0.5 }, 280, 150), 280, 150);
    };
    const start = performance.now();
    const animate = (now: number) => {
      if (cancelled) return;
      // 24fps is enough for a gallery preview and keeps a grid of 20 cards light.
      if (visible && now - lastPaint >= 1000 / 24) {
        draw(((now - start) / 1000) % 3);
        lastPaint = now;
      }
      frame = requestAnimationFrame(animate);
    };
    const ready = () => {
      if (animated) frame = requestAnimationFrame(animate);
      else draw(1.1);
    };
    void ensureFontsLoaded([style.font_name, style.accent_font_name]).then(ready);
    return () => { cancelled = true; cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [style, animated]);
  return <canvas aria-hidden ref={canvasRef} width={280} height={150} className="w-full h-auto" />;
}
