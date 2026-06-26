import { useRef, useCallback, useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useClipStore } from '@/stores/clipStore';

import { cn } from '@/lib/cn';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TimelineProps {
  zoom: number;
  onZoomChange: (zoom: number, anchorPx?: number) => void;
  followPlayhead: boolean;
}

type DragMode =
  | null
  | { kind: 'edge'; clipId: string; edge: 'start' | 'end'; origStart: number; origEnd: number }
  | { kind: 'move'; clipId: string; cursorOffsetTime: number; origStart: number; origEnd: number }
  | { kind: 'playhead' };

const MIN_DURATION = 0.5; // seconds
const HANDLE_WIDTH = 8;   // px

// Pick a "nice" marker interval (seconds) so ~6-12 markers are visible at any zoom
function pickMarkerInterval(visibleDuration: number): number {
  const candidates = [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1800, 3600];
  for (const c of candidates) {
    if (visibleDuration / c <= 12) return c;
  }
  return 7200;
}

export function Timeline({ zoom, onZoomChange, followPlayhead }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { videoTime, videoDuration, setVideoTime, videoPlaying } = useUIStore();
  const { clips, selectedClipId, selectClip, updateClip } = useClipStore();

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragDraft, setDragDraft] = useState<{ start: number; end: number } | null>(null);
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  // Convert cursor X (page coords) to time on the timeline
  const cursorToTime = useCallback((clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !videoDuration) return null;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    return pct * videoDuration;
  }, [videoDuration]);

  // Click on the empty track → seek
  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMode) return;
    const t = cursorToTime(e.clientX);
    if (t == null) return;
    setVideoTime(t);
    const vid = document.querySelector('video');
    if (vid) vid.currentTime = t;
  }, [cursorToTime, dragMode, setVideoTime]);

  // Mousedown on the playhead handle → start scrubbing
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode({ kind: 'playhead' });
  }, []);

  // Mousedown on an edge handle → resize that edge
  const handleEdgeMouseDown = useCallback((clipId: string, edge: 'start' | 'end', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = clips.find((c) => c.clip_id === clipId);
    if (!clip) return;
    setDragMode({ kind: 'edge', clipId, edge, origStart: clip.start_time, origEnd: clip.end_time });
    setDragDraft({ start: clip.start_time, end: clip.end_time });
  }, [clips]);

  // Mousedown on the clip body → move the entire clip (preserve duration)
  const handleClipBodyMouseDown = useCallback((clipId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = clips.find((c) => c.clip_id === clipId);
    if (!clip) return;
    selectClip(clipId);
    const cursorTime = cursorToTime(e.clientX);
    if (cursorTime == null) return;
    setDragMode({
      kind: 'move',
      clipId,
      cursorOffsetTime: cursorTime - clip.start_time, // distance from clip start to cursor
      origStart: clip.start_time,
      origEnd: clip.end_time,
    });
    setDragDraft({ start: clip.start_time, end: clip.end_time });
  }, [clips, cursorToTime, selectClip]);

  // Wheel: Ctrl+wheel = zoom centered on cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      const rect = scrollRef.current?.getBoundingClientRect();
      const anchor = rect ? e.clientX - rect.left : undefined;
      onZoomChange(zoom * factor, anchor);
    }
  }, [zoom, onZoomChange]);

  // Window-level drag handlers (work even when cursor leaves the timeline)
  useEffect(() => {
    if (!dragMode) return;

    const handleMove = (e: MouseEvent) => {
      const t = cursorToTime(e.clientX);
      if (t == null) return;

      if (dragMode.kind === 'playhead') {
        const clamped = Math.max(0, Math.min(videoDuration, t));
        setVideoTime(clamped);
        const vid = document.querySelector('video');
        if (vid) vid.currentTime = clamped;
        setTooltipText(formatTime(clamped));
      } else if (dragMode.kind === 'edge') {
        let newStart = dragMode.origStart;
        let newEnd = dragMode.origEnd;
        if (dragMode.edge === 'start') {
          newStart = Math.max(0, Math.min(t, dragMode.origEnd - MIN_DURATION));
        } else {
          newEnd = Math.min(videoDuration || Infinity, Math.max(t, dragMode.origStart + MIN_DURATION));
        }
        setDragDraft({ start: newStart, end: newEnd });
        const previewTime = dragMode.edge === 'start' ? newStart : newEnd;
        const vid = document.querySelector('video');
        if (vid) vid.currentTime = previewTime;
        setVideoTime(previewTime);
        setTooltipText(formatTime(previewTime));
      } else if (dragMode.kind === 'move') {
        const duration = dragMode.origEnd - dragMode.origStart;
        let newStart = t - dragMode.cursorOffsetTime;
        // Constrain within [0, videoDuration - duration]
        newStart = Math.max(0, Math.min(newStart, (videoDuration || Infinity) - duration));
        const newEnd = newStart + duration;
        setDragDraft({ start: newStart, end: newEnd });
        // Live-seek to clip start so user sees the new starting frame
        const vid = document.querySelector('video');
        if (vid) vid.currentTime = newStart;
        setVideoTime(newStart);
        setTooltipText(`${formatTime(newStart)} → ${formatTime(newEnd)}`);
      }

      // Tooltip position
      const containerRect = scrollRef.current?.getBoundingClientRect();
      if (containerRect) setTooltipX(e.clientX - containerRect.left);

      // Edge auto-scroll
      const scrollEl = scrollRef.current;
      if (scrollEl && containerRect) {
        const margin = 60;
        if (e.clientX < containerRect.left + margin) scrollEl.scrollLeft -= 12;
        else if (e.clientX > containerRect.right - margin) scrollEl.scrollLeft += 12;
      }
    };

    const handleUp = async () => {
      const mode = dragMode;
      const draft = dragDraft;
      setDragMode(null);
      setDragDraft(null);
      setTooltipText(null);

      if (mode.kind === 'playhead') return; // no save needed
      if (!draft) return;

      const orig = clips.find((c) => c.clip_id === mode.clipId);
      if (!orig) return;

      // Skip API call if no real change
      const noChange =
        Math.abs(draft.start - orig.start_time) < 0.01 &&
        Math.abs(draft.end - orig.end_time) < 0.01;
      if (noChange) return;

      const update: any = {};
      if (mode.kind === 'edge') {
        if (mode.edge === 'start') update.start_time = draft.start;
        else update.end_time = draft.end;
      } else if (mode.kind === 'move') {
        // Send both times together for an atomic move (backend computes new duration)
        update.start_time = draft.start;
        update.end_time = draft.end;
      }

      try {
        await updateClip(mode.clipId, update);
      } catch (err: any) {
        alert('Failed to update clip: ' + (err?.message || 'unknown'));
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragMode, dragDraft, cursorToTime, videoDuration, clips, updateClip, setVideoTime]);

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    if (!followPlayhead || !videoPlaying || !videoDuration) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const playheadX = (videoTime / videoDuration) * scrollEl.scrollWidth;
    const visibleStart = scrollEl.scrollLeft;
    const visibleEnd = visibleStart + scrollEl.clientWidth;
    const margin = scrollEl.clientWidth * 0.15;
    if (playheadX < visibleStart + margin || playheadX > visibleEnd - margin) {
      scrollEl.scrollLeft = playheadX - scrollEl.clientWidth / 2;
    }
  }, [videoTime, followPlayhead, videoPlaying, videoDuration, zoom]);

  // Body cursor while dragging (so it stays consistent even off the timeline)
  useEffect(() => {
    if (!dragMode) return;
    const cursor = dragMode.kind === 'edge' ? 'ew-resize' : 'grabbing';
    document.body.style.cursor = cursor;
    return () => { document.body.style.cursor = ''; };
  }, [dragMode]);

  if (!videoDuration) {
    return (
      <div className="h-full bg-surface px-4 py-3 text-xs text-text-dim text-center flex items-center justify-center">
        Load a video to use the timeline
      </div>
    );
  }

  // Compute marker interval based on visible duration
  const visibleDuration = videoDuration / zoom;
  const interval = pickMarkerInterval(visibleDuration);
  const markerCount = Math.ceil(videoDuration / interval) + 1;
  const markers = Array.from({ length: markerCount }, (_, i) => {
    const time = i * interval;
    return { time, pct: (time / videoDuration) * 100 };
  }).filter((m) => m.time <= videoDuration + 0.01);

  const playheadPct = (videoTime / videoDuration) * 100;
  const innerWidth = `${100 * zoom}%`;

  return (
    <div className="bg-surface relative h-full flex flex-col">
      <div
        ref={scrollRef}
        className="timeline-scroll-container overflow-x-scroll overflow-y-hidden flex-1"
        onWheel={handleWheel}
      >
        <div style={{ width: innerWidth, minWidth: '100%' }} className="relative px-4 pt-3 pb-2 h-full flex flex-col">
          {/* Time ruler */}
          <div className="relative h-5 mb-1 shrink-0">
            {markers.map((m, i) => (
              <div
                key={i}
                className="absolute text-[10px] text-text-dim font-mono -translate-x-1/2 select-none"
                style={{ left: `${m.pct}%` }}
              >
                {formatTime(m.time)}
              </div>
            ))}
          </div>

          {/* Track — fills remaining height */}
          <div
            ref={trackRef}
            className="relative bg-panel rounded-lg cursor-crosshair flex-1 min-h-[56px]"
            onClick={handleTrackClick}
          >
            {/* Tick marks for each marker */}
            {markers.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-border/50 pointer-events-none"
                style={{ left: `${m.pct}%` }}
              />
            ))}

            {/* Clip regions */}
            {clips.map((clip) => {
              const isDragging = (dragMode?.kind === 'edge' || dragMode?.kind === 'move') && dragMode.clipId === clip.clip_id && dragDraft;
              const start = isDragging ? dragDraft!.start : clip.start_time;
              const end = isDragging ? dragDraft!.end : clip.end_time;
              const left = (start / videoDuration) * 100;
              const width = ((end - start) / videoDuration) * 100;
              const isSelected = clip.clip_id === selectedClipId;

              return (
                <div
                  key={clip.clip_id}
                  onMouseDown={(e) => handleClipBodyMouseDown(clip.clip_id, e)}
                  onClick={(e) => { e.stopPropagation(); selectClip(clip.clip_id); }}
                  className={cn(
                    'absolute top-1 bottom-1 rounded transition-colors border group cursor-grab active:cursor-grabbing',
                    isSelected
                      ? 'bg-accent/30 border-accent z-10'
                      : 'bg-accent-blue/30 border-accent-blue/50 hover:bg-accent-blue/40',
                    isDragging && 'ring-2 ring-accent z-20',
                  )}
                  style={{ left: `${left}%`, width: `max(${Math.max(width, 0.3)}%, ${HANDLE_WIDTH * 2 + 4}px)` }}
                  title="Drag to move • Drag edges to trim"
                >
                  {/* Left resize handle */}
                  <div
                    onMouseDown={(e) => handleEdgeMouseDown(clip.clip_id, 'start', e)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-0 top-0 bottom-0 cursor-ew-resize hover:bg-accent/60 z-30 flex items-center justify-center"
                    style={{ width: HANDLE_WIDTH }}
                    title="Drag to change start time"
                  >
                    <div className="w-0.5 h-6 bg-white/70 rounded-full opacity-50 group-hover:opacity-100" />
                  </div>

                  {/* Right resize handle */}
                  <div
                    onMouseDown={(e) => handleEdgeMouseDown(clip.clip_id, 'end', e)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 bottom-0 cursor-ew-resize hover:bg-accent/60 z-30 flex items-center justify-center"
                    style={{ width: HANDLE_WIDTH }}
                    title="Drag to change end time"
                  >
                    <div className="w-0.5 h-6 bg-white/70 rounded-full opacity-50 group-hover:opacity-100" />
                  </div>

                  {/* Label */}
                  <div className="px-2.5 pt-0.5 text-[9px] text-white truncate font-medium pointer-events-none">
                    {clip.title || `Clip ${clip.index}`}
                  </div>
                  <div className="px-2.5 text-[8px] text-white/70 pointer-events-none">
                    {(end - start).toFixed(1)}s · {clip.score}
                  </div>
                </div>
              );
            })}

            {/* Playhead — line + draggable handle on top */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-accent z-20 pointer-events-none"
              style={{ left: `${playheadPct}%` }}
            />
            <div
              onMouseDown={handlePlayheadMouseDown}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'absolute top-0 z-30 flex flex-col items-center',
                dragMode?.kind === 'playhead' ? 'cursor-grabbing' : 'cursor-grab',
              )}
              style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }}
              title="Drag to scrub"
            >
              <div className="w-3 h-3 bg-accent rounded-full -translate-y-1 shadow-md hover:scale-125 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Drag tooltip */}
      {tooltipText && (
        <div
          className="pointer-events-none absolute z-50 bg-accent text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg -translate-x-1/2 -translate-y-full whitespace-nowrap"
          style={{ left: tooltipX, top: 30 }}
        >
          {tooltipText}
        </div>
      )}
    </div>
  );
}
