import { CanvasOverlay } from './CanvasOverlay';
import { drawTitleOverlay, resolveTitleStyle, type TitleStyle } from '../rendering/overlays';

export function TitleOverlay({ title, ...style }: Partial<TitleStyle> & { title: string }) {
  return <CanvasOverlay label={title} fonts={[style.fontName || 'Inter']}
    draw={(ctx, width, height) => drawTitleOverlay(ctx, title, resolveTitleStyle(style, width, height), width, height)} />;
}
