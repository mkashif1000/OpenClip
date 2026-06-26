/**
 * Layout Editor Modal.
 *
 * Opens when the user picks a non-Standard layout. Shows the SOURCE video at
 * its native aspect ratio so the user can frame what they actually have,
 * with one draggable+resizable box overlaid per output region.
 *
 *   ┌─ Customize "Split 2" Layout ────────────────────────────┐
 *   │                                                          │
 *   │  ┌──────────── Source video (native aspect) ─────────┐  │
 *   │  │  [Left ⬛  ][ Right ⬛ ]                          │  │
 *   │  │   (draggable boxes shaped to each output region)  │  │
 *   │  └──────────────────────────────────────────────────┘  │
 *   │                                                          │
 *   │  [Reset]                       [Cancel]  [Apply]        │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Each box's aspect ratio is LOCKED to its output region — picked from the
 * layout definition (e.g. for a 9:16 export with Split-2v, each region is
 * 4.5:16 so each crop box on the source is constrained to 4.5:16 aspect).
 *
 * On Apply, the boxes are saved as `clip.edits.regionCrops` and consumed by
 * canvasRenderer + MultiSplitComposition at render / preview time.
 */

import { useEffect, useRef, useState } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export type EditableLayout = 'pip' | 'gameplay' | 'split-2v' | 'split-3' | 'split-4';

export type Rect01 = { x: number; y: number; w: number; h: number };
type RegionDef = { label: string; out: Rect01 };

/** Output regions per layout, in normalized output coords [0,1]. */
function getRegionDefs(layout: EditableLayout): RegionDef[] {
  switch (layout) {
    case 'pip':
      return [
        { label: 'Top (Content)', out: { x: 0, y: 0, w: 1, h: 0.6 } },
        { label: 'Bottom (Speaker)', out: { x: 0, y: 0.6, w: 1, h: 0.4 } },
      ];
    case 'gameplay':
      return [
        { label: 'Face Cam', out: { x: 0.2, y: 0, w: 0.6, h: 0.35 } },
        { label: 'Main Content', out: { x: 0, y: 0.35, w: 1, h: 0.65 } },
      ];
    case 'split-2v':
      return [
        { label: 'Left', out: { x: 0, y: 0, w: 0.5, h: 1 } },
        { label: 'Right', out: { x: 0.5, y: 0, w: 0.5, h: 1 } },
      ];
    case 'split-3':
      return [
        { label: 'Left', out: { x: 0, y: 0, w: 1 / 3, h: 1 } },
        { label: 'Center', out: { x: 1 / 3, y: 0, w: 1 / 3, h: 1 } },
        { label: 'Right', out: { x: 2 / 3, y: 0, w: 1 / 3, h: 1 } },
      ];
    case 'split-4':
      return [
        { label: 'Top-Left', out: { x: 0, y: 0, w: 0.5, h: 0.5 } },
        { label: 'Top-Right', out: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
        { label: 'Bottom-Left', out: { x: 0, y: 0.5, w: 0.5, h: 0.5 } },
        { label: 'Bottom-Right', out: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
      ];
  }
}

/** Pixel aspect ratio (w/h) of an output region. */
function regionPxAspect(out: Rect01, outputAspect: number): number {
  // outputAspect = outputW / outputH; region px-w = outputW * out.w; px-h = outputH * out.h.
  return (out.w / out.h) * outputAspect;
}

/**
 * In source-normalized coords [0,1]²: pick a max-fit box whose PIXEL aspect
 * (w_n*sourceW) / (h_n*sourceH) equals targetPxAspect. Sets w_n/h_n so the
 * ratio holds, then centers it in source.
 */
function defaultCropForAspect(sourceAspect: number, targetPxAspect: number): Rect01 {
  // w_n / h_n = (targetPxAspect / sourceAspect)
  const R = targetPxAspect / sourceAspect;
  let w: number, h: number;
  if (R >= 1) {
    // crop is "wider than tall" relative to source → cap by width
    w = Math.min(1, 1);
    h = w / R;
  } else {
    h = Math.min(1, 1);
    w = h * R;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

interface Props {
  open: boolean;
  layout: EditableLayout;
  /** Source video blob URL (must be readable / decodable). */
  videoUrl: string | null;
  /** Frame to seek to as the preview (usually clip.start_time). */
  previewSec: number;
  /** Source video pixel aspect (width / height). */
  sourceAspect: number;
  /** Output video pixel aspect (width / height). */
  outputAspect: number;
  /** Existing crops to start with, in order. Empty → defaults. */
  initialCrops?: Rect01[];
  onApply: (crops: Rect01[]) => void;
  onClose: () => void;
}

export function LayoutEditorModal({
  open, layout, videoUrl, previewSec, sourceAspect, outputAspect,
  initialCrops, onApply, onClose,
}: Props) {
  const regions = getRegionDefs(layout);
  const targetPxAspects = regions.map((r) => regionPxAspect(r.out, outputAspect));

  // Source-normalized w_n / h_n ratios for each region (locks aspect on resize).
  const ratiosWnHn = targetPxAspects.map((a) => a / sourceAspect);

  const [crops, setCrops] = useState<Rect01[]>(() => regions.map((_, i) =>
    initialCrops?.[i] ?? defaultCropForAspect(sourceAspect, targetPxAspects[i]),
  ));
  const [selected, setSelected] = useState<number>(0);

  // Reseed when the layout or initialCrops list reference changes (modal reopen).
  useEffect(() => {
    if (!open) return;
    setCrops(regions.map((_, i) =>
      initialCrops?.[i] ?? defaultCropForAspect(sourceAspect, targetPxAspects[i]),
    ));
    setSelected(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layout]);

  // Seek the preview to previewSec, paused.
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => { v.currentTime = previewSec; v.pause(); };
    if (v.readyState >= 1) onMeta();
    else v.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [previewSec, videoUrl]);

  // Drag state per box.
  const sourceRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | {
    idx: number;
    mode: 'move' | 'resize';
    corner?: 'tl' | 'tr' | 'bl' | 'br';
    startX: number; startY: number;
    original: Rect01;
  }>(null);

  useEffect(() => {
    if (!drag) return;
    const rect = sourceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const onMove = (e: PointerEvent) => {
      const dx_n = (e.clientX - drag.startX) / rect.width;
      const dy_n = (e.clientY - drag.startY) / rect.height;
      const o = drag.original;
      const idx = drag.idx;
      const R = ratiosWnHn[idx];
      let next: Rect01 = { ...o };
      if (drag.mode === 'move') {
        next.x = Math.max(0, Math.min(1 - o.w, o.x + dx_n));
        next.y = Math.max(0, Math.min(1 - o.h, o.y + dy_n));
      } else {
        // Aspect-locked resize. The grow direction is determined by the
        // corner. We pick whichever delta moved the box's diagonal further,
        // then derive the other dimension via the locked ratio.
        const corner = drag.corner!;
        const signX = corner === 'tr' || corner === 'br' ? +1 : -1;
        const signY = corner === 'bl' || corner === 'br' ? +1 : -1;
        const candW = Math.max(0.05, Math.min(1, o.w + signX * dx_n));
        const candHfromW = candW / R;
        const candH = Math.max(0.05, Math.min(1, o.h + signY * dy_n));
        const candWfromH = candH * R;
        // Use whichever produced the bigger box change (so dragging feels
        // responsive on either axis); then snap the other dimension.
        let newW: number, newH: number;
        if (Math.abs(candW - o.w) >= Math.abs(candWfromH - o.w)) {
          newW = candW; newH = candHfromW;
        } else {
          newH = candH; newW = candWfromH;
        }
        // Clamp inside the source.
        newW = Math.min(newW, 1);
        newH = Math.min(newH, 1);
        // Reanchor x/y by which corner is fixed.
        let newX = o.x;
        let newY = o.y;
        if (corner === 'tl' || corner === 'bl') newX = o.x + o.w - newW;
        if (corner === 'tl' || corner === 'tr') newY = o.y + o.h - newH;
        // Clamp final position inside source.
        newX = Math.max(0, Math.min(1 - newW, newX));
        newY = Math.max(0, Math.min(1 - newH, newY));
        next = { x: newX, y: newY, w: newW, h: newH };
      }
      setCrops((cs) => cs.map((c, i) => (i === idx ? next : c)));
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = drag.mode === 'move' ? 'grabbing' :
      drag.corner === 'tl' || drag.corner === 'br' ? 'nwse-resize' : 'nesw-resize';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [drag, ratiosWnHn]);

  const reset = () => {
    setCrops(regions.map((_, i) => defaultCropForAspect(sourceAspect, targetPxAspects[i])));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(8, 8, 10, 0.85)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl mx-4 rounded-2xl glass-strong border border-white/15 shadow-pop animate-rise overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/8">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text">
              Customize {layout === 'pip' ? 'PIP'
                : layout === 'gameplay' ? 'Gameplay'
                : layout === 'split-2v' ? 'Split 2'
                : layout === 'split-3' ? 'Split 3'
                : 'Split 4'} Layout
            </h3>
            <p className="text-[11px] text-text-muted">
              Drag boxes on the source to set what each region of the output shows.
              Box shapes are locked to match the export aspect.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/8"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source preview with overlay boxes */}
        <div className="p-5 flex justify-center bg-black/30">
          <div
            ref={sourceRef}
            className="relative max-w-full"
            style={{
              aspectRatio: String(sourceAspect),
              maxHeight: '60vh',
              width: '100%',
            }}
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover rounded-md bg-black"
                preload="metadata"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md text-text-muted text-sm">
                Loading source…
              </div>
            )}

            {/* Boxes */}
            {crops.map((c, i) => {
              const isSel = i === selected;
              return (
                <div
                  key={i}
                  onPointerDown={(e) => {
                    setSelected(i);
                    e.preventDefault();
                    e.stopPropagation();
                    setDrag({ idx: i, mode: 'move', startX: e.clientX, startY: e.clientY, original: { ...c } });
                  }}
                  className={cn(
                    'absolute border-2 rounded-md cursor-grab active:cursor-grabbing',
                    isSel ? 'border-white ring-2 ring-white/30 bg-white/8 z-10' : 'border-white/60 bg-white/4 hover:bg-white/8',
                  )}
                  style={{
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    width: `${c.w * 100}%`,
                    height: `${c.h * 100}%`,
                  }}
                >
                  <div className="absolute -top-6 left-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white text-black font-semibold">
                    {regions[i].label}
                  </div>
                  {/* Corner handles */}
                  {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                    <div
                      key={corner}
                      onPointerDown={(e) => {
                        setSelected(i);
                        e.preventDefault();
                        e.stopPropagation();
                        setDrag({
                          idx: i, mode: 'resize', corner,
                          startX: e.clientX, startY: e.clientY, original: { ...c },
                        });
                      }}
                      className={cn(
                        'absolute w-3 h-3 bg-white border border-black/40 rounded-sm shadow-soft',
                        corner === 'tl' && '-top-1.5 -left-1.5 cursor-nwse-resize',
                        corner === 'tr' && '-top-1.5 -right-1.5 cursor-nesw-resize',
                        corner === 'bl' && '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                        corner === 'br' && '-bottom-1.5 -right-1.5 cursor-nwse-resize',
                      )}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Region buttons (quick select) */}
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {regions.map((r, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium border',
                i === selected ? 'bg-white text-black border-white' : 'glass-subtle text-text border-white/10 hover:bg-white/8',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/8">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-text-muted hover:text-text hover:bg-white/8 text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            Reset defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg glass-subtle border border-white/10 text-text text-sm font-medium hover:bg-white/8"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(crops)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black hover:bg-accent-hover text-sm font-medium shadow-soft"
            >
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
