import { useCurrentFrame, useVideoConfig } from 'remotion';
import { CanvasOverlay } from './CanvasOverlay';
import { drawSubtitleOverlay, resolveSubtitleStyle, type SubtitleStyle } from '../rendering/overlays';
import type { SubtitleEntry } from '../types/index';

export function SubtitleOverlay({ entries, clipStartSec, ...style }: Partial<SubtitleStyle> & {
  entries: SubtitleEntry[]; clipStartSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <CanvasOverlay label="Captions" fonts={[style.fontName || 'Arial', style.accent_font_name]}
    draw={(ctx, width, height) => drawSubtitleOverlay(ctx, entries, clipStartSec + frame / fps,
      clipStartSec, resolveSubtitleStyle(style, width, height), width, height)} />;
}
