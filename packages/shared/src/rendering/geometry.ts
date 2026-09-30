export type LayoutType =
  | 'standard'
  | 'pip'
  | 'hybrid'
  | 'gameplay'
  | 'split-2v'
  | 'split-2h'
  | 'split-3'
  | 'split-4'
  | 'boxed';

/** Round edges, not widths, so adjacent regions meet even at odd resolutions. */
export function getRegionRect(r: Rect01, width: number, height: number): Rect01 {
  const x = Math.round(r.x * width);
  const y = Math.round(r.y * height);
  return { x, y, w: Math.round((r.x + r.w) * width) - x, h: Math.round((r.y + r.h) * height) - y };
}

export function getPipRegions(width: number, height: number, ratio = 60): [Rect01, Rect01] {
  const top = Math.round(height * Math.max(0, Math.min(100, ratio)) / 100);
  return [{ x: 0, y: 0, w: width, h: top }, { x: 0, y: top, w: width, h: height - top }];
}

export function getBoxRect(width: number, height: number, options: {
  widthPct?: number; heightPct?: number; yPct?: number; radius?: number;
} = {}): Rect01 & { radius: number } {
  const w = Math.round(width * (options.widthPct ?? 84) / 100);
  const h = Math.round(height * (options.heightPct ?? 52) / 100);
  return {
    x: Math.round((width - w) / 2), y: Math.round(height * (options.yPct ?? 20) / 100), w, h,
    radius: Math.max(0, Math.min(options.radius ?? 40, Math.min(w, h) / 2)),
  };
}

/** CSS maps the same normalized source rectangle as canvas drawImage. */
export function cropVideoStyle(crop: Rect01) {
  return {
    position: 'absolute' as const,
    left: `${-crop.x / crop.w * 100}%`, top: `${-crop.y / crop.h * 100}%`,
    width: `${100 / crop.w}%`, height: `${100 / crop.h}%`,
    maxWidth: 'none', objectFit: 'fill' as const,
  };
}

/** Layouts that compose multiple crops of the same source into one output. */
export const SPLIT_LAYOUTS = new Set<LayoutType>(['gameplay', 'split-2v', 'split-2h', 'split-3', 'split-4']);


export type Rect01 = { x: number; y: number; w: number; h: number };
export type LayoutRegion = { out: Rect01; src: Rect01 };

function clampRect01(r: Rect01): Rect01 {
  const x = Math.max(0, Math.min(1, r.x));
  const y = Math.max(0, Math.min(1, r.y));
  const w = Math.max(0.05, Math.min(1 - x, r.w));
  const h = Math.max(0.05, Math.min(1 - y, r.h));
  return { x, y, w, h };
}

/**
 * Default regions per split layout. Source crops are sensible defaults — the
 * user can iterate on these later via the Edit tab if we add per-region tuning.
 * `faceCenter` is used by the Gameplay layout so the small face-cam tracks the
 * speaker if face-tracking is on.
 */
export function getSplitRegions(
  layout: LayoutType,
  faceCenter?: { x: number; y: number } | null,
): LayoutRegion[] {
  switch (layout) {
    case 'pip':
      // Big content view on top + smaller speaker box below. Defaults: content
      // shows the full frame, speaker crops the center.
      return [
        { out: { x: 0, y: 0, w: 1, h: 0.6 }, src: { x: 0, y: 0, w: 1, h: 1 } },
        { out: { x: 0, y: 0.6, w: 1, h: 0.4 }, src: clampRect01({ x: 0.3, y: 0.2, w: 0.4, h: 0.6 }) },
      ];
    case 'split-2v':
      // Left/right halves; each shows the matching half of the source so a
      // 16:9 podcast with two speakers reads naturally as "speaker A | speaker B".
      return [
        { out: { x: 0, y: 0, w: 0.5, h: 1 }, src: { x: 0, y: 0, w: 0.5, h: 1 } },
        { out: { x: 0.5, y: 0, w: 0.5, h: 1 }, src: { x: 0.5, y: 0, w: 0.5, h: 1 } },
      ];
    case 'split-2h':
      // Two-speaker stack: top/bottom rows. Defaults crop each speaker from
      // the left/right half of a side-by-side 16:9 podcast frame.
      return [
        { out: { x: 0, y: 0, w: 1, h: 0.5 }, src: { x: 0, y: 0.1, w: 0.5, h: 0.8 } },
        { out: { x: 0, y: 0.5, w: 1, h: 0.5 }, src: { x: 0.5, y: 0.1, w: 0.5, h: 0.8 } },
      ];
    case 'split-3':
      return [
        { out: { x: 0, y: 0, w: 1 / 3, h: 1 }, src: { x: 0, y: 0, w: 1 / 3, h: 1 } },
        { out: { x: 1 / 3, y: 0, w: 1 / 3, h: 1 }, src: { x: 1 / 3, y: 0, w: 1 / 3, h: 1 } },
        { out: { x: 2 / 3, y: 0, w: 1 / 3, h: 1 }, src: { x: 2 / 3, y: 0, w: 1 / 3, h: 1 } },
      ];
    case 'split-4':
      return [
        { out: { x: 0, y: 0, w: 0.5, h: 0.5 }, src: { x: 0, y: 0, w: 0.5, h: 0.5 } },
        { out: { x: 0.5, y: 0, w: 0.5, h: 0.5 }, src: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
        { out: { x: 0, y: 0.5, w: 0.5, h: 0.5 }, src: { x: 0, y: 0.5, w: 0.5, h: 0.5 } },
        { out: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, src: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
      ];
    case 'gameplay': {
      // Small face-cam on top + main content below. Same source for both, but
      // the face-cam crop is a tight box around the speaker (face-centered if
      // we have a track) and the bottom shows the full source.
      const faceCrop = faceCenter
        ? clampRect01({ x: faceCenter.x - 0.15, y: Math.max(0, faceCenter.y - 0.2), w: 0.3, h: 0.4 })
        : { x: 0.35, y: 0.05, w: 0.3, h: 0.4 };
      return [
        // Top 35% of output → small face cam
        { out: { x: 0.2, y: 0, w: 0.6, h: 0.35 }, src: faceCrop },
        // Bottom 65% of output → full source content
        { out: { x: 0, y: 0.35, w: 1, h: 0.65 }, src: { x: 0, y: 0, w: 1, h: 1 } },
      ];
    }
    default:
      return [];
  }
}


export function roundRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
