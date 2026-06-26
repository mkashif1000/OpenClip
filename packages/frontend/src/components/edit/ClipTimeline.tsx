/**
 * Per-clip timeline.
 *
 * Layout (top → bottom):
 *   ┌─ B-roll lane ─────────────────────────────────┐
 *   ├─ Title lane (read-only, spans the clip)  ────┤
 *   ├─ Music lane (read-only, spans the clip)  ────┤
 *   ├─ Logo lane (read-only, spans the clip)   ────┤
 *   └─ Source strip + draggable trim handles   ────┘
 *
 * The rail spans wider than the current clip range (clip ± pad) so the trim
 * handles can drag outward to *extend* the clip — not just shrink it. The
 * Source strip is positioned inside the rail at the actual clip range, and
 * the trim handles live at its left/right edges.
 *
 * The playhead handle is draggable for fine scrubbing; clicking anywhere on
 * the source strip seeks. B-roll chips can be moved (body drag) or resized
 * (edge drag).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Music as MusicIcon, Image as ImageIcon, Type, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { ClipData, ClipBroll } from '@/types';
import { cn } from '@/lib/cn';

interface Props {
  clip: ClipData;
  playheadSec: number;                                 // absolute source seconds
  cutRanges?: Array<{ start: number; end: number }>;
  selectedBrollId: string | null;
  onSelectBroll: (id: string | null) => void;
  onSeek: (sec: number) => void;
  onTrim: (start: number, end: number) => void;
  onBrollChange: (brolls: ClipBroll[]) => void;
  onBrollAdd: () => void;
  videoDurationSec?: number;
  /** Display only. Music track filename, when one is selected on the project. */
  musicLabel?: string | null;
  /** Display only. Logo filename, when one is configured on the project. */
  logoLabel?: string | null;
  /** The active title (custom override or clip.title) — for the title lane. */
  titleLabel?: string | null;
}

type DragKind =
  | { type: 'trim-start' }
  | { type: 'trim-end' }
  | { type: 'broll-move'; id: string; grabOffset: number }
  | { type: 'broll-resize-l'; id: string }
  | { type: 'broll-resize-r'; id: string }
  | { type: 'scrub' }
  | null;

const MIN_BROLL_LEN = 0.5;
const MIN_CLIP_LEN = 1.0;

export function ClipTimeline({
  clip, playheadSec, cutRanges, selectedBrollId, onSelectBroll,
  onSeek, onTrim, onBrollChange, onBrollAdd, videoDurationSec,
  musicLabel, logoLabel, titleLabel,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragKind>(null);

  const clipStart = clip.start_time;
  const clipEnd = clip.end_time;
  const clipDur = Math.max(clipEnd - clipStart, 0.001);

  // ─── Zoomable rail window ──────────────────────────────────────────
  // The rail is defined by a `zoom` factor (1 = fit-clip-with-padding,
  // higher = zoomed in) and a `focalSec` anchor (the source second that
  // sits at the rail's horizontal center). Mouse-wheel zooms toward the
  // cursor position; the +/- buttons keep the focal stable.
  //
  // Both reset on clip change. If the clip is trimmed BEYOND the current
  // window we widen the zoom so the strip is always visible (auto-fit-out).
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 30;
  const [zoom, setZoom] = useState(1);
  const [focalSec, setFocalSec] = useState<number | null>(null);

  useEffect(() => {
    setZoom(1);
    setFocalSec(null);
  }, [clip.clip_id]);

  // Base unzoomed span = clip + 60% pad each side, clamped to video bounds.
  const basePad = Math.max(10, clipDur * 0.6);
  const baseStart = Math.max(0, clipStart - basePad);
  const baseEnd = Math.min(videoDurationSec ?? clipEnd + basePad, clipEnd + basePad);
  const baseSpan = Math.max(0.001, baseEnd - baseStart);

  // Auto fit-out: ensure clip range is always visible even if user dragged trim
  // handles past the current zoom window.
  const requiredSpan = (clipEnd - clipStart) * 1.05;
  const effectiveZoom = Math.min(zoom, baseSpan / requiredSpan);

  const span = baseSpan / effectiveZoom;
  const center = focalSec ?? (clipStart + clipEnd) / 2;
  let railStart = center - span / 2;
  let railEnd = center + span / 2;
  if (railStart < 0) { railEnd += -railStart; railStart = 0; }
  if (videoDurationSec != null && railEnd > videoDurationSec) {
    const over = railEnd - videoDurationSec;
    railStart = Math.max(0, railStart - over);
    railEnd = videoDurationSec;
  }
  const railSpan = Math.max(railEnd - railStart, 0.001);

  const zoomBy = useCallback((factor: number, anchorSec?: number) => {
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
    if (anchorSec != null) setFocalSec(anchorSec);
  }, []);
  const fitTimeline = useCallback(() => {
    setZoom(1);
    setFocalSec(null);
  }, []);

  // Wheel-to-zoom. Bound on the OUTER timeline card so wheel over the lanes
  // / header / time labels all prevent page scroll equally.
  //
  // CRITICAL: the listener is attached ONCE on mount. railStart / railSpan
  // are read via refs from inside the callback. A previous version put them
  // in the effect deps which caused the listener to tear down + re-attach
  // on every zoom step — a wheel event landing during that gap escaped to
  // the page, exactly the symptom the user reported.
  //
  // Sensitivity scales with deltaMode so Mac trackpads (mode 0 = pixels,
  // many small deltas) and traditional mouse wheels (mode 1 = lines, few
  // large deltas) feel equally controlled. exp() gives smooth ratio-
  // preserving zoom.
  const containerRef = useRef<HTMLDivElement>(null);
  const railStartRef = useRef(railStart);
  const railSpanRef = useRef(railSpan);
  railStartRef.current = railStart;
  railSpanRef.current = railSpan;
  useEffect(() => {
    const el = containerRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = rail.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const cursorTime = railStartRef.current + (x / Math.max(rect.width, 1)) * railSpanRef.current;
      const sensitivity = e.deltaMode === 0 ? 0.0035 : 0.18;
      const factor = Math.exp(-e.deltaY * sensitivity);
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
      setFocalSec(cursorTime);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const pxToSec = useCallback((px: number): number => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return railStart;
    return railStart + (px / rect.width) * railSpan;
  }, [railStart, railSpan]);
  const secToPct = useCallback((sec: number): number => {
    return ((sec - railStart) / railSpan) * 100;
  }, [railStart, railSpan]);

  const brolls = clip.edits?.brolls ?? [];

  // ─── Global pointer handlers while dragging ─────────────────────────
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const rect = railRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const tNow = railStart + (x / rect.width) * railSpan;

      if (drag.type === 'scrub') {
        onSeek(tNow);
        return;
      }
      if (drag.type === 'trim-start') {
        const maxStart = Math.max(0, clipEnd - MIN_CLIP_LEN);
        const next = Math.max(0, Math.min(maxStart, tNow));
        onTrim(next, clipEnd);
        return;
      }
      if (drag.type === 'trim-end') {
        const minEnd = clipStart + MIN_CLIP_LEN;
        const max = videoDurationSec ?? clipEnd + 600;
        const next = Math.max(minEnd, Math.min(max, tNow));
        onTrim(clipStart, next);
        return;
      }
      // B-roll variants all carry an `id`
      if (drag.type !== 'broll-move' && drag.type !== 'broll-resize-l' && drag.type !== 'broll-resize-r') return;
      const b = brolls.find((x) => x.id === drag.id);
      if (!b) return;
      const len = b.endSec - b.startSec;
      let nextStart = b.startSec;
      let nextEnd = b.endSec;
      if (drag.type === 'broll-move') {
        nextStart = Math.max(clipStart, Math.min(clipEnd - len, tNow - drag.grabOffset));
        nextEnd = nextStart + len;
      } else if (drag.type === 'broll-resize-l') {
        nextStart = Math.max(clipStart, Math.min(b.endSec - MIN_BROLL_LEN, tNow));
      } else if (drag.type === 'broll-resize-r') {
        nextEnd = Math.max(b.startSec + MIN_BROLL_LEN, Math.min(clipEnd, tNow));
      }
      onBrollChange(
        brolls.map((x) => (x.id === b.id ? { ...x, startSec: nextStart, endSec: nextEnd } : x)),
      );
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor =
      drag.type === 'scrub' ? 'grabbing'
      : drag.type.startsWith('broll-resize') || drag.type.startsWith('trim') ? 'ew-resize'
      : 'grabbing';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [drag, brolls, railStart, railSpan, clipStart, clipEnd, videoDurationSec, onTrim, onBrollChange, onSeek]);

  const playheadPct = secToPct(playheadSec);
  const playheadInRail = playheadPct >= -0.5 && playheadPct <= 100.5;

  // Click on rail to seek (when not dragging).
  const onSourceClick = (e: React.MouseEvent) => {
    if (drag) return;
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    onSeek(pxToSec(e.clientX - rect.left));
  };

  const removeBroll = (id: string) => {
    onBrollChange(brolls.filter((b) => b.id !== id));
    if (selectedBrollId === id) onSelectBroll(null);
  };

  // Strip geometry (the clip range as a percentage of the rail).
  const stripLeft = secToPct(clipStart);
  const stripWidth = secToPct(clipEnd) - stripLeft;

  return (
    <div ref={containerRef} className="rounded-2xl glass p-3 hairline-top">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-text-dim uppercase tracking-[0.15em]">
            Timeline
          </span>
          <span className="text-[10px] text-text-muted font-mono">
            {clipDur.toFixed(1)}s
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Zoom controls (Premiere-style; mouse wheel on the rail also zooms) */}
          <div className="flex items-center mr-1 rounded-lg bg-white/4 border border-white/8 overflow-hidden">
            <button
              onClick={() => zoomBy(1 / 1.4)}
              title="Zoom out"
              className="px-1.5 py-1 text-text-muted hover:text-text hover:bg-white/8"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              onClick={fitTimeline}
              title="Fit timeline"
              className="px-1.5 py-1 text-text-muted hover:text-text hover:bg-white/8 border-x border-white/8"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => zoomBy(1.4)}
              title="Zoom in"
              className="px-1.5 py-1 text-text-muted hover:text-text hover:bg-white/8"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={onBrollAdd}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-text text-[11px] font-medium border border-white/10"
          >
            <Plus className="w-3 h-3" />
            B-roll
          </button>
        </div>
      </div>

      <div ref={railRef} className="relative select-none">
        {/* ─── B-roll lane ─────────────────────────────────────────── */}
        <div className="relative h-9 mb-1.5 rounded-lg bg-white/4 border border-white/8 overflow-hidden">
          {brolls.map((b) => {
            const left = secToPct(b.startSec);
            const width = secToPct(b.endSec) - left;
            const selected = b.id === selectedBrollId;
            return (
              <div
                key={b.id}
                className={cn(
                  'absolute top-0 bottom-0 group/chip rounded-md border cursor-grab active:cursor-grabbing transition-colors',
                  selected
                    ? 'bg-white/25 border-white/50 shadow-soft z-10'
                    : 'bg-white/15 border-white/25 hover:bg-white/20',
                )}
                style={{ left: `${left}%`, width: `${Math.max(0.5, width)}%` }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).dataset.role === 'resize') return;
                  e.preventDefault();
                  onSelectBroll(b.id);
                  const rect = railRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const x = e.clientX - rect.left;
                  setDrag({ type: 'broll-move', id: b.id, grabOffset: pxToSec(x) - b.startSec });
                }}
              >
                <div data-role="resize" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelectBroll(b.id); setDrag({ type: 'broll-resize-l', id: b.id }); }} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/60 rounded-l-md" />
                <div data-role="resize" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelectBroll(b.id); setDrag({ type: 'broll-resize-r', id: b.id }); }} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/60 rounded-r-md" />
                <div className="absolute inset-0 flex items-center px-2 gap-1 pointer-events-none">
                  <span className="text-[10px] text-text font-medium truncate">{b.label || 'B-roll'}</span>
                  <span className="text-[9px] text-text-muted font-mono ml-auto">{(b.endSec - b.startSec).toFixed(1)}s</span>
                </div>
                {selected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeBroll(b.id); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-error/90 text-white flex items-center justify-center opacity-0 group-hover/chip:opacity-100 z-10"
                    title="Remove B-roll"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
          {!brolls.length && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-text-dim">
              No B-roll · click "+ B-roll" to add
            </div>
          )}
        </div>

        {/* ─── Read-only display lanes (Title / Music / Logo) ─────── */}
        <DisplayLane
          icon={Type}
          label={titleLabel || 'Title'}
          leftPct={stripLeft}
          widthPct={stripWidth}
          tone="bg-white/8 border-white/15 text-text"
          empty={!titleLabel}
        />
        <DisplayLane
          icon={MusicIcon}
          label={musicLabel ?? 'No music selected'}
          leftPct={stripLeft}
          widthPct={stripWidth}
          tone="bg-white/6 border-white/12 text-text-muted"
          empty={!musicLabel}
        />
        <DisplayLane
          icon={ImageIcon}
          label={logoLabel ?? 'No logo configured'}
          leftPct={stripLeft}
          widthPct={stripWidth}
          tone="bg-white/6 border-white/12 text-text-muted"
          empty={!logoLabel}
        />

        {/* ─── Source strip (rail-wide background + clip strip + handles) ─── */}
        <div className="relative h-11 mt-1 rounded-lg bg-white/3 border border-white/6 overflow-visible">
          {/* Out-of-clip rail (subtle so user sees room to extend) */}
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,0.04)_3px_6px)]" />
          </div>

          {/* The actual clip strip (positioned inside the rail) */}
          <div
            className="absolute top-0 bottom-0 bg-white/12 border-2 border-white/40 cursor-text overflow-hidden rounded-md"
            style={{ left: `${stripLeft}%`, width: `${Math.max(0.5, stripWidth)}%` }}
            onClick={onSourceClick}
          >
            {/* Cut overlays (user-disabled words) — positioned within strip */}
            {(cutRanges ?? []).map((r, i) => {
              const rLeft = ((r.start - clipStart) / clipDur) * 100;
              const rWidth = ((r.end - r.start) / clipDur) * 100;
              if (rWidth <= 0) return null;
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 bg-error/25 border-l border-r border-error/40 pointer-events-none"
                  style={{ left: `${rLeft}%`, width: `${rWidth}%` }}
                />
              );
            })}
            <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
              <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Source</span>
            </div>
          </div>

          {/* Trim handles — sit ON the strip's edges */}
          <div
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ type: 'trim-start' }); }}
            title="Drag to extend or shrink the start"
            className="absolute top-0 bottom-0 w-3 cursor-ew-resize bg-white hover:bg-accent-hover rounded-l-md z-20 shadow-soft flex items-center justify-center"
            style={{ left: `${stripLeft}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-px h-4 bg-black/30" />
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-text-muted whitespace-nowrap bg-black/60 px-1 py-px rounded">
              {clipStart.toFixed(1)}s
            </div>
          </div>
          <div
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ type: 'trim-end' }); }}
            title="Drag to extend or shrink the end"
            className="absolute top-0 bottom-0 w-3 cursor-ew-resize bg-white hover:bg-accent-hover rounded-r-md z-20 shadow-soft flex items-center justify-center"
            style={{ left: `${stripLeft + stripWidth}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-px h-4 bg-black/30" />
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-text-muted whitespace-nowrap bg-black/60 px-1 py-px rounded">
              {clipEnd.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* ─── Playhead (draggable for scrubbing) ─────────────────── */}
        {playheadInRail && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white pointer-events-none z-30"
            style={{ left: `${Math.max(0, Math.min(100, playheadPct))}%`, boxShadow: '0 0 10px rgba(255,255,255,0.55)' }}
          >
            <div
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ type: 'scrub' }); }}
              className="absolute -top-1.5 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-soft cursor-grab active:cursor-grabbing pointer-events-auto ring-2 ring-black/30"
              title="Drag to scrub"
            />
          </div>
        )}
      </div>

      {/* Times */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-text-dim font-mono">
        <span>{clipStart.toFixed(2)}s</span>
        <span className="text-text-muted">{playheadSec.toFixed(2)}s</span>
        <span>{clipEnd.toFixed(2)}s</span>
      </div>
    </div>
  );
}

/** Compact display lane — a single chip spanning the clip range. */
function DisplayLane({
  icon: Icon, label, leftPct, widthPct, tone, empty,
}: {
  icon: React.ElementType;
  label: string;
  leftPct: number;
  widthPct: number;
  tone: string;
  empty?: boolean;
}) {
  return (
    <div className="relative h-6 mb-1 rounded-md bg-white/2 border border-white/6 overflow-hidden">
      {!empty && (
        <div
          className={cn('absolute top-0 bottom-0 rounded border flex items-center gap-1.5 px-2', tone)}
          style={{ left: `${leftPct}%`, width: `${Math.max(0.5, widthPct)}%` }}
        >
          <Icon className="w-2.5 h-2.5 shrink-0" strokeWidth={2} />
          <span className="text-[9px] font-medium truncate">{label}</span>
        </div>
      )}
      {empty && (
        <div className="absolute inset-0 flex items-center pl-2">
          <Icon className="w-2.5 h-2.5 text-text-dim mr-1.5 shrink-0" strokeWidth={1.5} />
          <span className="text-[9px] text-text-dim italic">{label}</span>
        </div>
      )}
    </div>
  );
}
