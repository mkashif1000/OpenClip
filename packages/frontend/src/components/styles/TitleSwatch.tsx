import { useEffect, useRef } from 'react';
import { drawTitleOverlay } from '@viral-clipper/shared/rendering/overlays';
import { titleStyleFromConfig } from '@viral-clipper/shared/rendering/titleConfig';
import { ensureFontsLoaded } from '@/services/fontLoader';
import type { TitleStyle } from '@/types';

export function TitleSwatch({ style }: { style: TitleStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      const ctx = ref.current?.getContext('2d');
      if (!ctx || cancelled) return;
      ctx.clearRect(0, 0, 280, 150);
      drawTitleOverlay(ctx, 'Your story starts here', titleStyleFromConfig({ ...style, enabled: true,
        font_size: 28, position_y: 50, position_x: 50, max_width: 94, padding: style.padding * 0.5,
        outline_width: (style.outline_width ?? 0) * 0.5, border_radius: (style.border_radius ?? 6) * 0.5,
        shadow_blur: (style.shadow_blur ?? 0) * 0.5 }, 280, 150, [0, 1, 0, 0]), 280, 150);
    };
    draw(); void ensureFontsLoaded([style.font_name]).then(draw);
    return () => { cancelled = true; };
  }, [style]);
  return <canvas ref={ref} width={280} height={150} className="w-full h-auto" aria-hidden />;
}
