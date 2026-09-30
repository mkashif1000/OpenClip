import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useVideoConfig } from 'remotion';
import { ensureFontsLoaded } from '../rendering/fontLoader';

/** Draw at output resolution; the Player scales the completed pixels. */
export function CanvasOverlay({ draw, fonts = [], label }: {
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  fonts?: Array<string | undefined>;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { width, height } = useVideoConfig();
  const [fontRevision, setFontRevision] = useState(0);
  const fontKey = JSON.stringify(fonts);
  useEffect(() => {
    let cancelled = false;
    void ensureFontsLoaded(JSON.parse(fontKey)).then(() => {
      if (!cancelled) setFontRevision((v) => v + 1);
    });
    return () => { cancelled = true; };
  }, [fontKey]);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    draw(ctx, width, height);
    ctx.restore();
    // fontRevision repaints paused previews after a font finishes loading.
  }, [draw, fontRevision, width, height]);
  return <canvas ref={ref} width={width} height={height} aria-label={label}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
