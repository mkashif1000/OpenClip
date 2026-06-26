import { useState, useEffect, useRef } from 'react';
import { Trash2, Edit3, Play } from 'lucide-react';
import { useClipStore } from '@/stores/clipStore';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { ClipThumbnail } from './ClipThumbnail';
import { cn } from '@/lib/cn';
import type { ClipData } from '@/types';

interface ClipCardProps {
  clip: ClipData;
  onEdit: (clip: ClipData) => void;
}

export function ClipCard({ clip, onEdit }: ClipCardProps) {
  const { selectedClipId, selectClip, removeClip, updateClip } = useClipStore();
  const setVideoTime = useUIStore((s) => s.setVideoTime);
  const videoFileId = useProjectStore((s) => s.currentProject?.video_file?.file_id ?? null);
  const isSelected = clip.clip_id === selectedClipId;

  // Local draft state for inline edits — synced with clip.start_time/end_time
  const [startDraft, setStartDraft] = useState(clip.start_time.toFixed(2));
  const [endDraft, setEndDraft] = useState(clip.end_time.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  // Reset drafts when clip times change externally (e.g., via timeline drag)
  useEffect(() => {
    setStartDraft(clip.start_time.toFixed(2));
    setEndDraft(clip.end_time.toFixed(2));
  }, [clip.start_time, clip.end_time]);

  const handlePlay = () => {
    selectClip(clip.clip_id);
    setVideoTime(clip.start_time);
    const vid = document.querySelector('video');
    if (vid) {
      vid.currentTime = clip.start_time;
      vid.play();
    }
  };

  const handleDelete = () => {
    if (confirm(`Delete clip "${clip.title || 'Untitled'}"?`)) {
      removeClip(clip.clip_id);
    }
  };

  const saveTimes = (newStart: number, newEnd: number) => {
    if (newEnd - newStart < 0.5) {
      setError('min 0.5s');
      return;
    }
    if (newStart < 0) {
      setError('start ≥ 0');
      return;
    }
    setError(null);
    const update: any = {};
    if (Math.abs(newStart - clip.start_time) > 0.005) update.start_time = newStart;
    if (Math.abs(newEnd - clip.end_time) > 0.005) update.end_time = newEnd;
    if (Object.keys(update).length === 0) return;
    updateClip(clip.clip_id, update).catch((err) => {
      setError(err?.message || 'failed');
    });
  };

  const debouncedSave = (newStart: number, newEnd: number) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveTimes(newStart, newEnd), 600);
  };

  const handleStartChange = (v: string) => {
    setStartDraft(v);
    const n = Number(v);
    if (!isNaN(n)) debouncedSave(n, Number(endDraft));
  };
  const handleEndChange = (v: string) => {
    setEndDraft(v);
    const n = Number(v);
    if (!isNaN(n)) debouncedSave(Number(startDraft), n);
  };
  const handleTimeBlur = () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveTimes(Number(startDraft), Number(endDraft));
  };

  const draftDuration = Math.max(0, Number(endDraft) - Number(startDraft));

  const scoreColor =
    clip.score >= 80 ? 'bg-success/20 text-success' :
    clip.score >= 50 ? 'bg-warning/20 text-warning' :
    'bg-error/20 text-error';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 cursor-pointer transition-all',
        isSelected
          ? 'border-accent bg-accent/5'
          : 'border-border bg-surface hover:border-accent/30'
      )}
      onClick={() => selectClip(clip.clip_id)}
    >
      <ClipThumbnail
        fileId={videoFileId}
        timeSec={clip.start_time + Math.min(2, clip.duration / 2)}
        className="w-full aspect-video mb-2"
      />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-text-dim w-5 shrink-0">#{clip.index}</span>
          <h4 className="text-sm font-medium text-text truncate">
            {clip.title || 'Untitled Clip'}
          </h4>
        </div>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', scoreColor)}>
          {clip.score}
        </span>
      </div>

      <p className="text-xs text-text-muted line-clamp-2 mb-2">{clip.preview_text}</p>

      {/* Inline editable times */}
      <div
        className="flex items-center gap-1.5 mb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="text-[10px] text-text-dim font-mono">In</label>
        <input
          type="number"
          step={0.1}
          min={0}
          value={startDraft}
          onChange={(e) => handleStartChange(e.target.value)}
          onBlur={handleTimeBlur}
          className="w-16 px-1.5 py-0.5 rounded bg-input border border-border text-text text-[11px] font-mono focus:outline-none focus:border-accent"
        />
        <label className="text-[10px] text-text-dim font-mono ml-1">Out</label>
        <input
          type="number"
          step={0.1}
          min={0}
          value={endDraft}
          onChange={(e) => handleEndChange(e.target.value)}
          onBlur={handleTimeBlur}
          className="w-16 px-1.5 py-0.5 rounded bg-input border border-border text-text text-[11px] font-mono focus:outline-none focus:border-accent"
        />
        <span className="text-[10px] text-text-dim font-mono ml-auto">
          {draftDuration.toFixed(1)}s
        </span>
      </div>
      {error && <p className="text-[10px] text-error mb-2">{error}</p>}

      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handlePlay(); }}
            className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-accent transition-colors"
            title="Play this clip">
            <Play className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(clip); }}
            className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-info transition-colors"
            title="Edit clip details">
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="p-1 rounded hover:bg-panel-light text-text-muted hover:text-error transition-colors"
            title="Delete clip">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Status indicator */}
      {clip.status !== 'pending' && (
        <div className={cn(
          'mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full inline-block',
          clip.status === 'completed' ? 'bg-success/15 text-success' :
          clip.status === 'processing' ? 'bg-info/15 text-info' :
          clip.status === 'failed' ? 'bg-error/15 text-error' : ''
        )}>
          {clip.status}
        </div>
      )}
    </div>
  );
}
