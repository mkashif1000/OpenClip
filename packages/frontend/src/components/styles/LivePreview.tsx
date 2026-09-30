import { useState, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import { useStyleStore } from '@/stores/styleStore';
import { opfsGetBlobUrl } from '@/services/opfs';
import { RemotionPreview } from '@/components/player/RemotionPreview';
import { mergeTemplateStyle, styleTemplateClip, type TemplateChoice } from '@/lib/templateSelection';
import type { ClipData } from '@/types';

interface LivePreviewProps {
  template?: TemplateChoice | null;
  musicSrc?: string;
  musicVolume?: number;
  logoSrc?: string;
  logoX?: number;
  logoY?: number;
  logoSize?: number;
  logoOpacity?: number;
}

export function LivePreview({ template, musicSrc, musicVolume, logoSrc, logoX, logoY, logoSize, logoOpacity }: LivePreviewProps = {}) {
  const project = useProjectStore((s) => s.currentProject);
  const clips = useClipStore((s) => s.clips);
  const currentStyles = useStyleStore((s) => s.styles);
  const videoFileId = project?.video_file?.file_id ?? null;
  const hasVideo = !!videoFileId;

  // The whole source video is loaded once from OPFS as a blob: URL. Each clip
  // is previewed by offsetting into that video via the composition's trimBefore
  // (driven by clip.start_time) — no server-side segment extraction needed.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState('');
  const [videoError, setVideoError] = useState(false);
  // Resolve the current object on every render, not a stale copy of its edits.
  const selectedClip = clips.find((clip) => clip.clip_id === selectedClipId) ?? clips[0];
  const sample: ClipData = {
    clip_id: 'import-template-sample', index: 1, title: 'Your next great clip',
    start_time: 0, end_time: Math.min(project?.video_file?.duration || 8, 8),
    duration: Math.min(project?.video_file?.duration || 8, 8), score: 0,
    preview_text: '', status: 'pending', output_file: null,
    entries: [{ start: '00:00:00,000', end: '00:00:08,000', text: 'Your captions will look like this.' }],
  };
  const sourceClip = selectedClip ?? sample;
  const clip = template ? styleTemplateClip(sourceClip, template) : sourceClip;
  const styles = template ? mergeTemplateStyle(template, currentStyles) : currentStyles;
  const layout = clip.edits?.layout ?? 'standard';
  const pip = layout === 'pip' ? clip.edits?.pipConfig : undefined;
  const splitLayout = layout !== 'standard' && layout !== 'boxed' && !pip ? layout : undefined;

  useEffect(() => {
    setVideoUrl(null);
    setVideoError(false);
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
        if (!cancelled) setVideoError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [videoFileId]);

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
    <section aria-label="Import live preview" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Live Preview</h3>
        {clips.length > 1 && (
          <button
            onClick={() => {
              const idx = selectedClip ? clips.findIndex((c) => c.clip_id === selectedClip.clip_id) : -1;
              setSelectedClipId(clips[(idx + 1) % clips.length].clip_id);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-muted hover:text-accent transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Next Clip
          </button>
        )}
      </div>

      <p className="text-xs text-text-muted" aria-live="polite">{template?.name ?? 'Current project style'}</p>
      <div className="max-w-[260px] mx-auto rounded-lg overflow-hidden border border-border" data-preview-layout={layout} data-preview-template={template?.id ?? ''}>
        {videoUrl ? (
          <RemotionPreview
            key={`${videoFileId}:${clip.clip_id}`}
            clip={clip}
            videoSegmentUrl={videoUrl}
            overrideSubtitle={styles.subtitle}
            overrideTitle={styles.title}
            width={styles.export.width}
            height={styles.export.height}
            boxed={layout === 'boxed'}
            boxWidthPct={styles.export.box_width}
            boxHeightPct={styles.export.box_height}
            boxYPct={styles.export.box_y}
            boxRadiusPx={styles.export.box_radius}
            splitLayout={splitLayout}
            regionCrops={clip.edits?.regionCrops}
            splitRange={clip.edits?.layoutRange}
            overridePip={pip}
            musicSrc={musicSrc}
            musicVolume={musicVolume}
            logoSrc={logoSrc}
            logoX={logoX}
            logoY={logoY}
            logoSize={logoSize}
            logoOpacity={logoOpacity}
            controls
            autoPlay={false}
            loop
          />
        ) : (
          <div className="flex items-center justify-center aspect-[9/16] bg-panel">
            {videoError ? (
              <p role="alert" className="px-4 text-center text-xs text-warning">Could not load this video. Try reopening the project.</p>
            ) : (
              <Loader2 aria-label="Loading preview" className="w-6 h-6 text-accent animate-spin" />
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-dim text-center">
        {!selectedClip ? 'Sample title and captions on your video. Load clips to preview your own text.' : 'Previewing: ' + (selectedClip.edits?.customTitle || selectedClip.title)}
      </p>
    </section>
  );
}
