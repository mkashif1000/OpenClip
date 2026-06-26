import { useState, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import { opfsGetBlobUrl } from '@/services/opfs';
import { RemotionPreview } from '@/components/player/RemotionPreview';

interface LivePreviewProps {
  musicSrc?: string;
  musicVolume?: number;
  logoSrc?: string;
  logoX?: number;
  logoY?: number;
  logoSize?: number;
  logoOpacity?: number;
}

export function LivePreview({ musicSrc, musicVolume, logoSrc, logoX, logoY, logoSize, logoOpacity }: LivePreviewProps = {}) {
  const project = useProjectStore((s) => s.currentProject);
  const clips = useClipStore((s) => s.clips);
  const videoFileId = project?.video_file?.file_id ?? null;
  const hasVideo = !!videoFileId;

  // The whole source video is loaded once from OPFS as a blob: URL. Each clip
  // is previewed by offsetting into that video via the composition's trimBefore
  // (driven by clip.start_time) — no server-side segment extraction needed.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<typeof clips[0] | null>(null);

  useEffect(() => {
    if (!videoFileId) {
      setVideoUrl(null);
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        url = await opfsGetBlobUrl(videoFileId);
        if (cancelled) URL.revokeObjectURL(url);
        else setVideoUrl(url);
      } catch {
        if (!cancelled) setVideoUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [videoFileId]);

  // Default to the first clip; keep the current selection if it still exists.
  useEffect(() => {
    setSelectedClip((prev) =>
      prev && clips.some((c) => c.clip_id === prev.clip_id) ? prev : clips[0] ?? null,
    );
  }, [clips]);

  if (!hasVideo) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text">Live Preview</h3>
        <div className="flex items-center justify-center rounded-lg border border-border bg-panel aspect-[9/16] max-w-[260px] mx-auto">
          <p className="text-xs text-text-dim text-center px-4">
            Upload a video and load clips to see a live preview
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Live Preview</h3>
        {clips.length > 1 && (
          <button
            onClick={() => {
              const idx = selectedClip ? clips.findIndex((c) => c.clip_id === selectedClip.clip_id) : -1;
              setSelectedClip(clips[(idx + 1) % clips.length]);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-muted hover:text-accent transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Next Clip
          </button>
        )}
      </div>

      <div className="max-w-[260px] mx-auto rounded-lg overflow-hidden border border-border">
        {videoUrl && selectedClip ? (
          <RemotionPreview
            clip={selectedClip}
            videoSegmentUrl={videoUrl}
            musicSrc={musicSrc}
            musicVolume={musicVolume}
            logoSrc={logoSrc}
            logoX={logoX}
            logoY={logoY}
            logoSize={logoSize}
            logoOpacity={logoOpacity}
            controls
            autoPlay
            loop
          />
        ) : (
          <div className="flex items-center justify-center aspect-[9/16] bg-panel">
            {!videoUrl ? (
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            ) : (
              <p className="text-xs text-text-dim">Load clips to preview</p>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-dim text-center">
        Remotion Player — exactly matches output
      </p>
    </div>
  );
}
