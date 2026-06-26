import { useState, useRef, useCallback, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import type { PIPBox, PIPConfig } from '@/types';

const DEFAULT_CONTENT_BOX: PIPBox = { x: 0, y: 0, width: 100, height: 55 };
const DEFAULT_SPEAKER_BOX: PIPBox = { x: 70, y: 60, width: 28, height: 35 };
const DEFAULT_SPLIT_RATIO = 60;

type DragMode = null | { box: 'content' | 'speaker'; action: 'move' | 'resize'; startX: number; startY: number; startBox: PIPBox };

interface PIPEditorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  config: PIPConfig;
  onConfigChange: (config: PIPConfig) => void;
  clipId?: string; // optional — if provided, locks the background frame to this clip
}

export function PIPEditor({ enabled, onEnabledChange, config, onConfigChange, clipId }: PIPEditorProps) {
  const clips = useClipStore((s) => s.clips);
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  // When clipId prop is provided (Re-PIP use case), the clip is locked
  // When not provided (template creator), user can pick which clip frame to view
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const { contentBox, speakerBox, splitRatio } = config;

  const setContentBox = (box: PIPBox) => onConfigChange({ ...config, contentBox: box });
  const setSpeakerBox = (box: PIPBox) => onConfigChange({ ...config, speakerBox: box });
  const setSplitRatio = (ratio: number) => onConfigChange({ ...config, splitRatio: ratio });

  // Determine which clip's frame to display
  const effectiveClipId = clipId ?? selectedClipId ?? clips[0]?.clip_id ?? null;

  // Generate thumbnail from local video via canvas
  useEffect(() => {
    const project = useProjectStore.getState().currentProject;
    const clip = clips.find((c) => c.clip_id === effectiveClipId);
    if (!project?.video_file?.path || !clip) return;

    let cancelled = false;
    (async () => {
      try {
        const { opfsGetBlobUrl } = await import('@/services/opfs');
        const videoUrl = await opfsGetBlobUrl(project.video_file!.path);
        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true;
        video.preload = 'metadata';
        await new Promise<void>((res, rej) => {
          video.onloadedmetadata = () => res();
          video.onerror = () => rej();
        });
        video.currentTime = clip.start_time + clip.duration * 0.1;
        await new Promise<void>((res) => { video.onseeked = () => res(); });
        const canvas = document.createElement('canvas');
        canvas.width = 800; canvas.height = 450;
        canvas.getContext('2d')?.drawImage(video, 0, 0, 800, 450);
        if (!cancelled) setFrameUrl(canvas.toDataURL('image/jpeg', 0.8));
        URL.revokeObjectURL(videoUrl);
      } catch {
        // Silently fail — PIP editor works without thumbnail
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveClipId, clips]);

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((box: 'content' | 'speaker', action: 'move' | 'resize', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getRelativePos(e);
    const startBox = box === 'content' ? { ...contentBox } : { ...speakerBox };
    setDragMode({ box, action, startX: pos.x, startY: pos.y, startBox });
  }, [contentBox, speakerBox, getRelativePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragMode) return;
    const pos = getRelativePos(e);
    const dx = pos.x - dragMode.startX;
    const dy = pos.y - dragMode.startY;
    const { startBox } = dragMode;
    const setBox = dragMode.box === 'content' ? setContentBox : setSpeakerBox;

    if (dragMode.action === 'move') {
      setBox({
        ...startBox,
        x: Math.max(0, Math.min(100 - startBox.width, startBox.x + dx)),
        y: Math.max(0, Math.min(100 - startBox.height, startBox.y + dy)),
      });
    } else {
      // Lock aspect ratio: output is 9:16, source is 16:9
      // The box captures a region from the 16:9 source, shown in the 9:16 output
      // Content gets splitRatio% of output height, speaker gets the rest
      // Aspect ratio of each output region = 9 / (16 * regionFraction)
      const regionFrac = dragMode.box === 'content' ? splitRatio / 100 : (100 - splitRatio) / 100;
      // Output region ratio: width=9, height=16*regionFrac → ratio = 9/(16*regionFrac)
      // In source-% terms: for every 1% width, height should be (sourceW/sourceH) * (1/ratio)
      // Source is 16:9 → sourceW/sourceH = 16/9
      // Combined: heightPerWidth = (16/9) / (9/(16*regionFrac)) = (16*16*regionFrac)/(9*9)
      const aspectRatio = (16 * 16 * regionFrac) / (9 * 9);
      const newWidth = Math.max(10, Math.min(100 - startBox.x, startBox.width + dx));
      const newHeight = newWidth * aspectRatio;
      setBox({
        ...startBox,
        width: newWidth,
        height: Math.max(10, Math.min(100 - startBox.y, newHeight)),
      });
    }
  }, [dragMode, getRelativePos, splitRatio]);

  const handleMouseUp = useCallback(() => {
    setDragMode(null);
  }, []);

  const handleReset = () => {
    onConfigChange({
      contentBox: DEFAULT_CONTENT_BOX,
      speakerBox: DEFAULT_SPEAKER_BOX,
      splitRatio: DEFAULT_SPLIT_RATIO,
    });
  };

  const renderBox = (box: PIPBox, label: string, color: string, boxId: 'content' | 'speaker') => (
    <div
      key={boxId}
      style={{
        position: 'absolute',
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        border: `2px solid ${color}`,
        backgroundColor: `${color}20`,
        cursor: dragMode?.box === boxId ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={(e) => handleMouseDown(boxId, 'move', e)}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: 4,
          fontSize: 11,
          fontWeight: 600,
          color,
          textShadow: '0 0 3px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
      <div
        style={{
          position: 'absolute',
          right: -4,
          bottom: -4,
          width: 10,
          height: 10,
          backgroundColor: color,
          cursor: 'nwse-resize',
          borderRadius: 2,
        }}
        onMouseDown={(e) => handleMouseDown(boxId, 'resize', e)}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-accent"
          />
          <span className="text-sm font-semibold text-text">PIP Layout</span>
        </label>
        {enabled && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-panel hover:bg-panel-light text-text-muted transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {!enabled && (
        <p className="text-xs text-text-dim">Enable to crop two regions from the video and stack them vertically.</p>
      )}

      {enabled && (
        <>
          <p className="text-xs text-text-dim">
            Drag boxes on the frame. Blue = content (top), Green = speaker (bottom).
          </p>

          {/* Clip frame picker — only shown when clipId prop is NOT forced (template creator) */}
          {!clipId && clips.length > 1 && (
            <div>
              <label className="block text-xs text-text-muted mb-1">Background Frame (from clip)</label>
              <select
                value={effectiveClipId ?? ''}
                onChange={(e) => setSelectedClipId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-xs focus:outline-none focus:border-accent"
              >
                {clips.map((c) => (
                  <option key={c.clip_id} value={c.clip_id}>
                    #{c.index} {c.title || 'Untitled'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Video frame canvas */}
          <div
            ref={containerRef}
            className="relative w-full bg-panel rounded-lg overflow-hidden border border-border"
            style={{ aspectRatio: '16/9' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {frameUrl ? (
              <img src={frameUrl} alt="Video frame" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-dim text-sm">
                Load clips first to see video frame
              </div>
            )}
            {renderBox(contentBox, 'Content', '#3B82F6', 'content')}
            {renderBox(speakerBox, 'Speaker', '#22C55E', 'speaker')}
          </div>

          {/* Split ratio slider */}
          <div>
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Split Ratio</span>
              <span>Content {splitRatio}% / Speaker {100 - splitRatio}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={80}
              value={splitRatio}
              onChange={(e) => setSplitRatio(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          {/* Box coordinates */}
          <div className="grid grid-cols-2 gap-3 text-xs text-text-muted">
            <div className="p-2 rounded bg-surface border border-border">
              <span className="font-semibold text-blue-400">Content:</span>{' '}
              x:{contentBox.x.toFixed(0)}% y:{contentBox.y.toFixed(0)}% w:{contentBox.width.toFixed(0)}% h:{contentBox.height.toFixed(0)}%
            </div>
            <div className="p-2 rounded bg-surface border border-border">
              <span className="font-semibold text-green-400">Speaker:</span>{' '}
              x:{speakerBox.x.toFixed(0)}% y:{speakerBox.y.toFixed(0)}% w:{speakerBox.width.toFixed(0)}% h:{speakerBox.height.toFixed(0)}%
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { DEFAULT_CONTENT_BOX, DEFAULT_SPEAKER_BOX, DEFAULT_SPLIT_RATIO };
