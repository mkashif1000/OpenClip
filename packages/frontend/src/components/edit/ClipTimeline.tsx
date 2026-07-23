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
  | { type: 'pan'; startClientX: number; startCenter: number; startSpan: number }
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

  // Trim edits are buffered locally while dragging and committed ONCE on
  // pointer-up. Committing per pointermove wrote to the store + IndexedDB on
  // every mouse move — visibly janky — and re-derived the rail window from
  // the moving clip range, so the rail rescaled under the cursor (the
  // "behaves weirdly at the edges" feedback loop).
  const [pendingTrim, setPendingTrim] = useState<{ s: number; e: number } | null>(null);
  const pendingTrimRef = useRef<{ s: number; e: number } | null>(null);
  const setPending = (v: { s: number; e: number } | null) => {
    pendingTrimRef.current = v;
    setPendingTrim(v);
  };

  const clipStart = pendingTrim?.s ?? clip.start_time;
  const clipEnd = pendingTrim?.e ?? clip.end_time;
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

  // The rail's base window is FROZEN to the clip range at selection time.
  // Deriving it from the live clip range meant every trim-drag move rescaled
  // the rail under the cursor — the coordinate system the drag was mapping
  // through — producing runaway / erratic edge drags.
  const anchorRef = useRef({ start: clip.start_time, end: clip.end_time });
  const lastClipIdRef = useRef(clip.clip_id);
  if (lastClipIdRef.current !== clip.clip_id) {
    // Re-freeze the anchor synchronously on clip change (no one-frame flicker).
    lastClipIdRef.current = clip.clip_id;
    anchorRef.current = { start: clip.start_time, end: clip.end_time };
  }
  useEffect(() => {
    // Reset view state (zoom/pan/buffered-trim) when the selected clip changes.
    setZoom(1);
    setFocalSec(null);
    setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.clip_id]);

  const anchorDur = Math.max(anchorRef.current.end - anchorRef.current.start, 0.001);
  const basePad = Math.max(10, anchorDur * 0.6);
  const baseStart = Math.max(0, anchorRef.current.start - basePad);
  const baseEnd = Math.min(
    videoDurationSec ?? anchorRef.current.end + basePad,
    anchorRef.current.end + basePad,
  );
  const baseSpan = Math.max(0.001, baseEnd - baseStart);

  const effectiveZoom = zoom;
  const span = baseSpan / effectiveZoom;
  // Default center = FROZEN anchor midpoint (not the live/pending clip range),
  // so the rail stays put while you drag a trim handle. Panning sets focalSec.
  const center = focalSec ?? (anchorRef.current.start + anchorRef.current.end) / 2;
  let railStart = center - span / 2;
  let railEnd = center + span / 2;
  if (railStart < 0) { railEnd += -railStart; railStart = 0; }
  if (videoDurationSec != null && railEnd > videoDurationSec) {
    const over = railEnd - videoDurationSec;
    railStart = Math.max(0, railStart - over);
    railEnd = videoDurationSec;
  }
  const railSpan = Math.max(railEnd - railStart, 0.001);

  // Clamp a pan target so the visible window never leaves [0, videoDuration].
  // This is what stops the rail from "sliding out of the screen".
  const clampCenter = useCallback((c: number, forSpan: number) => {
    const half = forSpan / 2;
    if (videoDurationSec == null) return Math.max(half, c);
    if (videoDurationSec <= forSpan) return videoDurationSec / 2;
    return Math.min(Math.max(c, half), videoDurationSec - half);
  }, [videoDurationSec]);

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
  const centerRef = useRef(center);
  const clampCenterRef = useRef(clampCenter);
  railStartRef.current = railStart;
  railSpanRef.current = railSpan;
  centerRef.current = center;
  clampCenterRef.current = clampCenter;
  useEffect(() => {
    const el = containerRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = rail.getBoundingClientRect();
      // Horizontal wheel / trackpad swipe / Shift+wheel = PAN. Everything
      // else = zoom toward the cursor.
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (horizontal || e.shiftKey) {
        const delta = horizontal ? e.deltaX : e.deltaY;
        const px = e.deltaMode === 0 ? delta : delta * 30;
        const dSec = (px / Math.max(rect.width, 1)) * railSpanRef.current;
        setFocalSec(clampCenterRef.current(centerRef.current + dSec, railSpanRef.current));
        return;
      }
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

  /** Clamp a [startPct,endPct] span into the visible 0–100 window.
   *  Returns null when fully off-screen — chips must never bleed outside. */
  const clampRange = (startPct: number, endPct: number) => {
    const left = Math.max(0, startPct);
    const right = Math.min(100, endPct);
    return right - left <= 0 ? null : { left, width: right - left };
  };

  // ─── Adaptive time ruler ────────────────────────────────────────────
  // Pick a tick step that yields ~5–10 labels for the current zoom.
  const TICK_STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const tickStep = TICK_STEPS.find((s) => railSpan / s <= 10) ?? 600;
  const ticks: number[] = [];
  for (let t = Math.ceil(railStart / tickStep) * tickStep; t <= railEnd + 1e-6; t += tickStep) {
    ticks.push(Number(t.toFixed(3)));
  }
  const fmtTick = (t: number) => {
    if (t >= 60) {
      const m = Math.floor(t / 60);
      const s = t - m * 60;
      return `${m}:${s < 10 ? '0' : ''}${Number.isInteger(s) ? s : s.toFixed(1)}`;
    }
    return Number.isInteger(t) ? `${t}s` : `${t.toFixed(2).replace(/0$/, '')}s`;
  };

  const brolls = clip.edits?.brolls ?? [];

  // Live values read INSIDE the once-bound pointer handlers via refs, so the
  // drag listener never re-subscribes mid-drag (re-subscribing dropped pointer
  // events → the erratic edge behavior). The opposite trim edge / b-roll clamps
  // use the COMMITTED clip bounds, which are stable across a single drag.
  const brollsRef = useRef(brolls); brollsRef.current = brolls;
  const committedRef = useRef({ s: clip.start_time, e: clip.end_time });
  committedRef.current = { s: clip.start_time, e: clip.end_time };
  const videoDurRef = useRef(videoDurationSec); videoDurRef.current = videoDurationSec;
  const cbRef = useRef({ onTrim, onBrollChange, onSeek });
  cbRef.current = { onTrim, onBrollChange, onSeek };

  // ─── Global pointer handlers while dragging (bound ONCE per drag) ────
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const rect = railRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rStart = railStartRef.current;
      const rSpan = railSpanRef.current;
      const rawX = e.clientX - rect.left;
      const x = Math.max(0, Math.min(rect.width, rawX));
      const tNow = rStart + (x / rect.width) * rSpan;

      // Edge auto-pan: dragging past the rail edge scrolls the window.
      if (drag.type !== 'pan' && (rawX < 0 || rawX > rect.width)) {
        const dir = rawX < 0 ? -1 : 1;
        setFocalSec(clampCenterRef.current(centerRef.current + dir * rSpan * 0.03, rSpan));
      }

      if (drag.type === 'pan') {
        const dxPx = e.clientX - drag.startClientX;
        const dSec = -(dxPx / Math.max(rect.width, 1)) * drag.startSpan;
        setFocalSec(clampCenterRef.current(drag.startCenter + dSec, drag.startSpan));
        return;
      }
      if (drag.type === 'scrub') { cbRef.current.onSeek(tNow); return; }

      const cm = committedRef.current;
      if (drag.type === 'trim-start') {
        const maxStart = Math.max(0, cm.e - MIN_CLIP_LEN);
        setPending({ s: Math.max(0, Math.min(maxStart, tNow)), e: cm.e });
        return;
      }
      if (drag.type === 'trim-end') {
        const minEnd = cm.s + MIN_CLIP_LEN;
        const max = videoDurRef.current ?? cm.e + 3600;
        setPending({ s: cm.s, e: Math.max(minEnd, Math.min(max, tNow)) });
        return;
      }
      // B-roll variants all carry an `id`
      if (drag.type !== 'broll-move' && drag.type !== 'broll-resize-l' && drag.type !== 'broll-resize-r') return;
      const list = brollsRef.current;
      const b = list.find((x) => x.id === drag.id);
      if (!b) return;
      const len = b.endSec - b.startSec;
      let nextStart = b.startSec;
      let nextEnd = b.endSec;
      if (drag.type === 'broll-move') {
        nextStart = Math.max(cm.s, Math.min(cm.e - len, tNow - drag.grabOffset));
        nextEnd = nextStart + len;
      } else if (drag.type === 'broll-resize-l') {
        nextStart = Math.max(cm.s, Math.min(b.endSec - MIN_BROLL_LEN, tNow));
      } else if (drag.type === 'broll-resize-r') {
        nextEnd = Math.max(b.startSec + MIN_BROLL_LEN, Math.min(cm.e, tNow));
      }
      cbRef.current.onBrollChange(
        list.map((x) => (x.id === b.id ? { ...x, startSec: nextStart, endSec: nextEnd } : x)),
      );
    };
    const onUp = () => {
      // Commit a buffered trim exactly once, on release.
      const p = pendingTrimRef.current;
      if (p && (drag.type === 'trim-start' || drag.type === 'trim-end')) {
        cbRef.current.onTrim(p.s, p.e);
        setPending(null);
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor =
      drag.type === 'scrub' || drag.type === 'pan' ? 'grabbing'
      : drag.type.startsWith('broll-resize') || drag.type.startsWith('trim') ? 'ew-resize'
      : 'grabbing';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    // Bound once per drag — reads live geometry/callbacks from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const playheadPct = secToPct(playheadSec);
  const playheadInRail = playheadPct >= -0.5 && playheadPct <= 100.5;

  // Auto-follow: while playing (or seeking) with the playhead outside the
  // zoomed view, pan the window so the playhead re-enters at 25% from the
  // edge — like every desktop editor. Never fights an active drag.
  useEffect(() => {
    if (drag) return;
    const pct = ((playheadSec - railStart) / railSpan) * 100;
    if (pct > 100.5) setFocalSec(clampCenter(playheadSec + railSpan * 0.25, railSpan));
    else if (pct < -0.5) setFocalSec(clampCenter(playheadSec - railSpan * 0.25, railSpan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadSec]);

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
  // Clamped variant for chips/lanes so nothing ever renders outside the rail.
  const stripClamped = clampRange(stripLeft, stripLeft + stripWidth);
  // Trim-handle positions, clamped into view. When a handle's true position is
  // off-screen it pins to the edge at reduced opacity (drag still works).
  const startHandlePct = Math.max(0, Math.min(100, stripLeft));
  const endHandlePct = Math.max(0, Math.min(100, stripLeft + stripWidth));
  const startHandleOff = stripLeft < 0 || stripLeft > 100;
  const endHandleOff = stripLeft + stripWidth < 0 || stripLeft + stripWidth > 100;

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
        {/* ─── Time ruler (click/drag to seek) ─────────────────────── */}
        <div
          className="relative h-5 mb-1 cursor-pointer"
          onPointerDown={(e) => {
            e.preventDefault();
            const rect = railRef.current?.getBoundingClientRect();
            if (!rect) return;
            onSeek(pxToSec(e.clientX - rect.left));
            setDrag({ type: 'scrub' });
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
          {ticks.map((t) => {
            const pct = secToPct(t);
            if (pct < 0 || pct > 100) return null;
            return (
              <div key={t} className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ left: `${pct}%` }}>
                <span className="text-[8px] text-text-dim font-mono leading-none mb-0.5">{fmtTick(t)}</span>
                <div className="w-px h-1.5 bg-white/25" />
              </div>
            );
          })}
        </div>

        {/* ─── B-roll lane ─────────────────────────────────────────── */}
        <div className="relative h-9 mb-1.5 rounded-lg bg-white/4 border border-white/8 overflow-hidden">
          {brolls.map((b) => {
            const rawLeft = secToPct(b.startSec);
            const rawRight = secToPct(b.endSec);
            const c = clampRange(rawLeft, rawRight);
            if (!c) return null; // fully outside the visible window
            const { left, width } = c;
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
          leftPct={stripClamped?.left ?? 0}
          widthPct={stripClamped?.width ?? 0}
          tone="bg-white/8 border-white/15 text-text"
          empty={!titleLabel || !stripClamped}
        />
        <DisplayLane
          icon={MusicIcon}
          label={musicLabel ?? 'No music selected'}
          leftPct={stripClamped?.left ?? 0}
          widthPct={stripClamped?.width ?? 0}
          tone="bg-white/6 border-white/12 text-text-muted"
          empty={!musicLabel || !stripClamped}
        />
        <DisplayLane
          icon={ImageIcon}
          label={logoLabel ?? 'No logo configured'}
          leftPct={stripClamped?.left ?? 0}
          widthPct={stripClamped?.width ?? 0}
          tone="bg-white/6 border-white/12 text-text-muted"
          empty={!logoLabel || !stripClamped}
        />

        {/* ─── Source strip (rail-wide background + clip strip + handles) ───
            All horizontal positions are clamped into the 0–100% window, so
            nothing can slide outside the card no matter the zoom/pan. */}
        <div className="relative h-11 mt-1 rounded-lg bg-white/3 border border-white/6">
          {/* Out-of-clip rail — also the drag-to-pan surface */}
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <div
              className="absolute inset-0 cursor-grab active:cursor-grabbing bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,0.04)_3px_6px)]"
              title="Drag to pan the timeline"
              onPointerDown={(e) => {
                e.preventDefault();
                setDrag({ type: 'pan', startClientX: e.clientX, startCenter: center, startSpan: railSpan });
              }}
            />
          </div>

          {/* The actual clip strip (clamped into view) */}
          {stripClamped && (
            <div
              className={cn(
                'absolute top-0 bottom-0 bg-white/12 border-y-2 border-white/40 cursor-text overflow-hidden',
                !startHandleOff && 'border-l-2 rounded-l-md',
                !endHandleOff && 'border-r-2 rounded-r-md',
              )}
              style={{ left: `${stripClamped.left}%`, width: `${Math.max(0.5, stripClamped.width)}%` }}
              onClick={onSourceClick}
            >
              <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
                <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Source</span>
              </div>
            </div>
          )}

          {/* Cut overlays (user-disabled words) — rail coordinates, clamped */}
          {(cutRanges ?? []).map((r, i) => {
            const c = clampRange(secToPct(r.start), secToPct(r.end));
            if (!c) return null;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 bg-error/25 border-l border-r border-error/40 pointer-events-none"
                style={{ left: `${c.left}%`, width: `${c.width}%` }}
              />
            );
          })}

          {/* Trim handles — pinned to the rail edge (dimmed) when their true
              position is outside the visible window */}
          <div
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ type: 'trim-start' }); }}
            title="Drag to extend or shrink the start"
            className={cn(
              'absolute top-0 bottom-0 w-3 cursor-ew-resize bg-white hover:bg-accent-hover rounded-l-md z-20 shadow-soft flex items-center justify-center',
              startHandleOff && 'opacity-40',
            )}
            style={
              startHandleOff
                ? (startHandlePct >= 100 ? { right: 0 } : { left: 0 })
                : { left: `${startHandlePct}%`, transform: 'translateX(-50%)' }
            }
          >
            <div className="w-px h-4 bg-black/30" />
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-text-muted whitespace-nowrap bg-black/60 px-1 py-px rounded">
              {clipStart.toFixed(1)}s
            </div>
          </div>
          <div
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ type: 'trim-end' }); }}
            title="Drag to extend or shrink the end"
            className={cn(
              'absolute top-0 bottom-0 w-3 cursor-ew-resize bg-white hover:bg-accent-hover rounded-r-md z-20 shadow-soft flex items-center justify-center',
              endHandleOff && 'opacity-40',
            )}
            style={
              endHandleOff
                ? (endHandlePct >= 100 ? { right: 0 } : { left: 0 })
                : { left: `${endHandlePct}%`, transform: 'translateX(-50%)' }
            }
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

      {/* Footer: clip times + zoom readout + interaction hints */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-text-dim font-mono">
        <span>{clipStart.toFixed(2)}s – {clipEnd.toFixed(2)}s</span>
        <span className="text-text-muted">▶ {playheadSec.toFixed(2)}s</span>
        <span className="hidden sm:inline font-sans text-[9px] text-text-dim">
          scroll = zoom · shift+scroll / drag background = pan
        </span>
        <span>{effectiveZoom.toFixed(1)}×</span>
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
