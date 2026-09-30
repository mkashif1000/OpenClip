import { useEffect, useState } from 'react';
import { CanvasOverlay } from './CanvasOverlay';
import { drawLogoOverlay } from '../rendering/overlays';

interface LogoOverlayProps {
  logoSrc: string;
  logoX?: number; logoY?: number; logoSize?: number; logoOpacity?: number;
}

export function LogoOverlay({ logoSrc, logoX = 50, logoY = 85, logoSize = 15, logoOpacity = 1 }: LogoOverlayProps) {
  const [image, setImage] = useState<{ src: string; value: HTMLImageElement } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { if (!cancelled) setImage({ src: logoSrc, value: img }); };
    img.src = logoSrc;
    return () => { cancelled = true; };
  }, [logoSrc]);
  return <CanvasOverlay label="Logo" draw={(ctx, width, height) => {
    if (image?.src === logoSrc) drawLogoOverlay(ctx, image.value,
      { x: logoX, y: logoY, size: logoSize, opacity: logoOpacity }, width, height);
  }} />;
}
