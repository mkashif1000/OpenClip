import { ZoomIn, ZoomOut, Maximize2, ChevronsLeft, ChevronsRight, Crosshair } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useClipStore } from '@/stores/clipStore';
import { cn } from '@/lib/cn';

interface TimelineControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  followPlayhead: boolean;
  onFollowPlayheadChange: (v: boolean) => void;
}

export function TimelineControls({
  zoom, onZoomIn, onZoomOut, onZoomFit,
  followPlayhead, onFollowPlayheadChange,
}: TimelineControlsProps) {
  const { videoTime, videoDuration } = useUIStore();
  const { clips, selectedClipId, updateClip } = useClipStore();

  const selectedClip = clips.find((c) => c.clip_id === selectedClipId) || null;
  const canSetIn = !!selectedClip && videoTime < (selectedClip.end_time - 0.5);
  const canSetOut = !!selectedClip && videoTime > (selectedClip.start_time + 0.5)
    && (!videoDuration || videoTime <= videoDuration);

  const handleSetIn = async () => {
    if (!selectedClip || !canSetIn) return;
    try {
      await updateClip(selectedClip.clip_id, { start_time: Math.max(0, videoTime) });
    } catch (err: any) {
      alert('Failed to set start: ' + (err?.message || 'unknown'));
    }
  };

  const handleSetOut = async () => {
    if (!selectedClip || !canSetOut) return;
    try {
      await updateClip(selectedClip.clip_id, { end_time: videoTime });
    } catch (err: any) {
      alert('Failed to set end: ' + (err?.message || 'unknown'));
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface border-t border-border">
      {/* Left: In/Out point controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSetIn}
          disabled={!canSetIn}
          title={selectedClip ? `Set start of "${selectedClip.title || 'clip'}" to ${videoTime.toFixed(2)}s (I)` : 'Select a clip first'}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-panel hover:bg-panel-light text-text-muted hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
          Set Start
          <kbd className="ml-1 text-[9px] px-1 py-px rounded bg-input text-text-dim font-mono">I</kbd>
        </button>
        <button
          onClick={handleSetOut}
          disabled={!canSetOut}
          title={selectedClip ? `Set end of "${selectedClip.title || 'clip'}" to ${videoTime.toFixed(2)}s (O)` : 'Select a clip first'}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-panel hover:bg-panel-light text-text-muted hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Set End
          <ChevronsRight className="w-3.5 h-3.5" />
          <kbd className="ml-1 text-[9px] px-1 py-px rounded bg-input text-text-dim font-mono">O</kbd>
        </button>

        {selectedClip && (
          <span className="ml-3 text-[10px] text-text-dim font-mono">
            #{selectedClip.index} · {selectedClip.duration.toFixed(1)}s
          </span>
        )}
      </div>

      {/* Right: zoom controls + follow playhead toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onFollowPlayheadChange(!followPlayhead)}
          title="Auto-scroll to keep playhead visible"
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            followPlayhead
              ? 'bg-accent/20 text-accent'
              : 'bg-panel hover:bg-panel-light text-text-muted hover:text-text'
          )}
        >
          <Crosshair className="w-3.5 h-3.5" />
          Follow
        </button>

        <div className="flex items-center gap-1 px-1 py-1 rounded bg-panel">
          <button
            onClick={onZoomOut}
            title="Zoom out (-)"
            className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-text transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-text-muted w-12 text-center">
            {zoom < 10 ? zoom.toFixed(1) : Math.round(zoom)}x
          </span>
          <button
            onClick={onZoomIn}
            title="Zoom in (=)"
            className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-text transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onZoomFit}
            title="Fit to view (0)"
            className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-text transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
