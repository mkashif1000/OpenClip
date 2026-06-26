/**
 * Per-clip editor. Pick a clip in the top strip, edit it on the canvas below.
 *
 *   ┌─ Clip selector strip ──────────────────────────────────────────────┐
 *   │  [thumb #1][thumb #2][thumb #3]…                                   │
 *   └───────────────────────────────────────────────────────────────────┘
 *   ┌─ Transcript ─┬─ Preview & Timeline ──────────────┬─ Tools ──────────┐
 *   │  word word   │  ┌─────────────┐                  │ Title input      │
 *   │  word word   │  │             │                  │ Font picker      │
 *   │  ...         │  │   <video>   │                  │ Layout buttons   │
 *   │              │  └─────────────┘                  │ B-roll details   │
 *   │              │  ┌───────────────┐                │                  │
 *   │              │  │ B-roll lane   │                │                  │
 *   │              │  │ ━━━━━━━━━━━━━ │                │                  │
 *   │              │  └───────────────┘                │                  │
 *   └──────────────┴───────────────────────────────────┴──────────────────┘
 */

import { useEffect, useRef, useState } from 'react';
import {
  Film, Scissors, Loader2, ChevronLeft, ChevronRight, Download,
  Type, Upload, Pause, Play, RotateCcw, Layout as LayoutIcon, FileVideo, ListChecks,
  CheckCircle2,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import { useProcessingStore } from '@/stores/processingStore';
import { useUIStore } from '@/stores/uiStore';
import type { ClipData, ClipBroll, ClipEdits, PIPConfig } from '@/types';
import type { WhisperWord } from '@/services/whisperService';
import { cn } from '@/lib/cn';
import { computeOutputDims } from '@/lib/outputDims';
import { ClipThumbnail } from '@/components/clips/ClipThumbnail';
import { TranscriptEditor } from '@/components/edit/TranscriptEditor';
import { ClipTimeline } from '@/components/edit/ClipTimeline';
import { LayoutEditorModal, type EditableLayout, type Rect01 } from '@/components/edit/LayoutEditorModal';
import { useStyleStore } from '@/stores/styleStore';
import { RemotionPreview, type PlayerRef } from '@/components/player/RemotionPreview';

const PREVIEW_FPS = 30; // Must match RemotionPreview's internal fps.

export function EditTab() {
  const project = useProjectStore((s) => s.currentProject);
  const { clips, selectedClipId, selectClip, updateClip } = useClipStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  // Default-select the first clip when one isn't picked.
  useEffect(() => {
    if (!selectedClipId && clips.length) selectClip(clips[0].clip_id);
  }, [selectedClipId, clips, selectClip]);

  const clip = clips.find((c) => c.clip_id === selectedClipId) ?? null;
  const videoOpfsId = project?.video_file?.path;
  const videoDuration = project?.video_file?.duration;

  // ─── Video / music / logo blob URLs (loaded once per project asset) ─
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false;
    let url: string | null = null;
    (async () => {
      if (!videoOpfsId) return;
      const { opfsGetBlobUrl } = await import('@/services/opfs');
      url = await opfsGetBlobUrl(videoOpfsId);
      if (!revoked) setVideoUrl(url);
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
      setVideoUrl(null);
    };
  }, [videoOpfsId]);

  // Music + logo blob URLs — loaded so the live preview reflects them.
  const selectedTrack = (project?.music_tracks ?? []).find((t) => t.selected) ?? null;
  const musicOpfsId = selectedTrack?.path ?? null;
  const logoOpfsId = project?.logo_config?.file_id ?? null;
  const [musicBlobUrl, setMusicBlobUrl] = useState<string | null>(null);
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false; let url: string | null = null;
    (async () => {
      if (!musicOpfsId) { setMusicBlobUrl(null); return; }
      try {
        const { opfsGetBlobUrl } = await import('@/services/opfs');
        url = await opfsGetBlobUrl(musicOpfsId);
        if (!revoked) setMusicBlobUrl(url);
      } catch { if (!revoked) setMusicBlobUrl(null); }
    })();
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
  }, [musicOpfsId]);
  useEffect(() => {
    let revoked = false; let url: string | null = null;
    (async () => {
      if (!logoOpfsId) { setLogoBlobUrl(null); return; }
      try {
        const { opfsGetBlobUrl } = await import('@/services/opfs');
        url = await opfsGetBlobUrl(logoOpfsId);
        if (!revoked) setLogoBlobUrl(url);
      } catch { if (!revoked) setLogoBlobUrl(null); }
    })();
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
  }, [logoOpfsId]);

  // ─── B-roll blob URLs ───────────────────────────────────────────────
  // Load each user B-roll item as a blob URL so the Remotion preview can
  // overlay them at their span. URLs are revoked when brolls change so we
  // don't leak.
  const [brollUrls, setBrollUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const items = clip?.edits?.brolls ?? [];
    if (!items.length) {
      setBrollUrls({});
      return;
    }
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      const { opfsGetBlobUrl } = await import('@/services/opfs');
      const out: Record<string, string> = {};
      for (const b of items) {
        try {
          const u = await opfsGetBlobUrl(b.fileId);
          out[b.id] = u;
          created.push(u);
        } catch { /* skip unreadable items */ }
      }
      if (!cancelled) setBrollUrls(out);
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [clip?.edits?.brolls]);

  // ─── Layout editor modal state ──────────────────────────────────────
  // Opens when the user picks a non-Standard layout chip. Apply persists the
  // per-region source crops to clip.edits.regionCrops, consumed at render +
  // preview time.
  const exportStyles = useStyleStore((s) => s.styles.export);
  const [editingLayout, setEditingLayout] = useState<EditableLayout | null>(null);

  // Preview at the real export resolution so caption/title sizes match output.
  const previewDims = computeOutputDims(exportStyles, project?.video_file?.width, project?.video_file?.height);

  const handlePickLayout = (layout: ClipEdits['layout']) => {
    if (!clip) return;
    updateEdits({ layout });
    if (layout && layout !== 'standard') {
      setEditingLayout(layout as EditableLayout);
    }
  };

  // Source + output aspect ratios for the modal.
  // 'match_source' is NOT "use source aspect" — processingStore actually
  // re-frames the source into a 9:16 vertical for that format (OpenClip is
  // short-form-vertical first). The export is 9:16 for every format except
  // explicit horizontal, so that's what we use here. Otherwise the modal's
  // crop boxes inherit the source's aspect and end up full-width, which is
  // wrong: their combined ratios should equal the 9:16 output.
  const sourceW = project?.video_file?.width;
  const sourceH = project?.video_file?.height;
  const sourceAspect = sourceW && sourceH ? sourceW / sourceH : 16 / 9;
  const outputAspect = (() => {
    const fmt = exportStyles.format || 'match_source';
    if (fmt === 'horizontal') return 16 / 9;
    return 9 / 16;
  })();

  // ─── Whisper words (project-level) ──────────────────────────────────
  const [words, setWords] = useState<WhisperWord[] | null>(null);
  const [wordsLoading, setWordsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!project?.whisper_words) { setWords(null); return; }
      setWordsLoading(true);
      try {
        const { opfsReadFile } = await import('@/services/opfs');
        const f = await opfsReadFile(project.whisper_words);
        const data = JSON.parse(await f.text()) as WhisperWord[];
        if (!cancelled) setWords(Array.isArray(data) ? data : null);
      } catch (err) {
        console.warn('Could not load transcript:', err);
        if (!cancelled) setWords(null);
      } finally {
        if (!cancelled) setWordsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [project?.whisper_words]);

  // ─── Playback state (driven by Remotion <Player> via callback ref) ─
  // We use a state-backed ref so React re-runs the subscription effect when
  // the Remotion <Player> finally mounts (which happens AFTER the first
  // render because it's gated on videoUrl loading from OPFS). Previously a
  // plain useRef left subscriptions unattached and the playhead never moved.
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const [playheadSec, setPlayheadSec] = useState(clip?.start_time ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedBrollId, setSelectedBrollId] = useState<string | null>(null);

  // Reset playhead + selection when switching clips.
  useEffect(() => {
    setSelectedBrollId(null);
    setPlayheadSec(clip?.start_time ?? 0);
    setIsPlaying(false);
    player?.pause();
    player?.seekTo(0);
  }, [clip?.clip_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to Remotion frame updates → derive source seconds + auto-skip
  // user-disabled cut ranges so the preview matches the rendered output.
  useEffect(() => {
    if (!player || !clip) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      const srcSec = clip.start_time + e.detail.frame / PREVIEW_FPS;
      setPlayheadSec(srcSec);
      const ranges = clip.edits?.cutRanges;
      if (ranges?.length) {
        for (const r of ranges) {
          if (srcSec >= r.start && srcSec < r.end - 0.05) {
            const skipFrame = Math.ceil((r.end - clip.start_time) * PREVIEW_FPS);
            player.seekTo(skipFrame);
            return;
          }
        }
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [player, clip?.clip_id, clip?.start_time, clip?.edits?.cutRanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Translate an absolute-source-seconds seek into a Remotion frame seek.
  const seekToSrcSec = (sourceSec: number) => {
    if (!clip) return;
    const clamped = Math.max(clip.start_time, Math.min(clip.end_time, sourceSec));
    const frame = Math.max(0, Math.round((clamped - clip.start_time) * PREVIEW_FPS));
    player?.seekTo(frame);
    setPlayheadSec(clamped);
  };

  // ─── Per-clip edits helpers ─────────────────────────────────────────
  const updateEdits = (patch: Partial<ClipEdits>) => {
    if (!clip) return;
    const merged: ClipEdits = { ...(clip.edits ?? {}), ...patch };
    updateClip(clip.clip_id, { edits: merged }).catch(console.error);
  };

  // (Realtime cut-skip is handled inside the Remotion frameupdate handler above.)

  // ─── Render & download (use Process pipeline directly) ─────────────
  const renderClipsAction = useProcessingStore((s) => s.renderClips);
  const downloadClipAction = useProcessingStore((s) => s.downloadClip);
  const isProcessing = useProcessingStore((s) => s.isProcessing);
  const clipProgress = useProcessingStore((s) => clip ? s.clipProgress[clip.clip_id] : null);
  const outputBlob = useProcessingStore((s) => clip ? s.outputBlobs[clip.clip_id] : null);

  const handleRenderAndDownload = async () => {
    if (!clip || isProcessing) return;
    await renderClipsAction([clip.clip_id]);
    // downloadClipAction reads the freshly-rendered blob from the store.
    downloadClipAction(clip.clip_id);
  };

  // ─── Empty states ───────────────────────────────────────────────────
  if (!project?.video_file) {
    return (
      <EmptyEdit
        icon={Film}
        title="No video imported"
        body="Import a video file in the Import tab first."
        cta={{ label: 'Go to Import', onClick: () => setActiveTab('import') }}
      />
    );
  }
  if (!clips.length) {
    return (
      <EmptyEdit
        icon={Scissors}
        title="No clips yet"
        body="Upload a clips JSON (or generate them) in the Import tab first."
        cta={{ label: 'Go to Import', onClick: () => setActiveTab('import') }}
      />
    );
  }
  if (!clip) return null;

  return (
    <div className="h-full flex flex-col p-4 lg:p-6 gap-4 overflow-hidden">
      {/* ─── Top header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between animate-rise gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text tracking-tight">Edit Clip</h2>
          <p className="text-xs text-text-muted">
            Trim, edit transcript, swap layout, and curate B-roll for each clip.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-[10px] text-text-dim">
            <span>Edits autosave</span>
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-soft-pulse" />
          </div>
          <button
            onClick={handleRenderAndDownload}
            disabled={isProcessing}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shadow-soft transition-colors',
              isProcessing
                ? 'bg-white/10 text-text-muted cursor-not-allowed border border-white/8'
                : 'bg-white text-black hover:bg-accent-hover',
            )}
            title="Render this clip with all edits, then download"
          >
            {isProcessing && clipProgress?.percent != null && clipProgress.percent < 100 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {Math.round(clipProgress.percent)}%
              </>
            ) : outputBlob ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-success" />
                Re-render & Download
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Render & Download
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── Clip selector strip ──────────────────────────────────── */}
      <ClipSelector
        clips={clips}
        selectedId={clip.clip_id}
        videoOpfsId={videoOpfsId}
        onSelect={(id) => selectClip(id)}
      />

      {/* ─── Main grid ────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Left: Transcript */}
        <div className="col-span-3 rounded-2xl glass overflow-hidden flex flex-col animate-rise hairline-top">
          <TranscriptEditor
            clip={clip}
            words={words}
            loading={wordsLoading}
            playheadSec={playheadSec}
            onCutsChange={(cuts) => updateEdits({ cutRanges: cuts.length ? cuts : undefined })}
            onSeek={seekToSrcSec}
          />
        </div>

        {/* Center: preview + timeline */}
        <div className="col-span-6 flex flex-col gap-3 min-h-0">
          {/* ─── Live preview (Remotion — matches the exported video) ───── */}
          <div className="flex-1 rounded-2xl glass hairline-top p-3 flex items-center justify-center overflow-hidden animate-rise min-h-0" style={{ animationDelay: '50ms' }}>
            <div className="relative h-full max-h-full flex items-center justify-center">
              {videoUrl ? (
                <div className="relative h-full aspect-[9/16] max-w-full rounded-lg overflow-hidden ring-1 ring-white/10 bg-black">
                  <RemotionPreview
                    playerRef={setPlayer}
                    clip={clip.edits?.customTitle != null ? { ...clip, title: clip.edits.customTitle } : clip}
                    videoSegmentUrl={videoUrl}
                    width={previewDims.width}
                    height={previewDims.height}
                    musicSrc={musicBlobUrl ?? undefined}
                    musicVolume={selectedTrack?.volume}
                    logoSrc={logoBlobUrl ?? undefined}
                    logoX={project.logo_config?.x}
                    logoY={project.logo_config?.y}
                    logoSize={project.logo_config?.size}
                    logoOpacity={project.logo_config?.opacity}
                    overridePip={clip.edits?.layout === 'pip' && clip.edits.pipConfig ? clip.edits.pipConfig : undefined}
                    splitLayout={
                      clip.edits?.layout === 'gameplay' ||
                      clip.edits?.layout === 'split-2v' ||
                      clip.edits?.layout === 'split-3' ||
                      clip.edits?.layout === 'split-4'
                        ? clip.edits.layout
                        : undefined
                    }
                    titleFontName={clip.edits?.titleFont}
                    titleWordColors={clip.edits?.titleColors}
                    boxed={clip.edits?.layout === 'boxed'}
                    boxRadiusPx={exportStyles.box_radius}
                    brolls={(clip.edits?.brolls ?? [])
                      .map((b) => {
                        const src = brollUrls[b.id];
                        if (!src) return null;
                        const startFrame = Math.max(0, Math.round((b.startSec - clip.start_time) * PREVIEW_FPS));
                        const durationInFrames = Math.max(1, Math.round((b.endSec - b.startSec) * PREVIEW_FPS));
                        return { src, startFrame, durationInFrames };
                      })
                      .filter((x): x is { src: string; startFrame: number; durationInFrames: number } => !!x)}
                    controls={false}
                    autoPlay={false}
                    loop
                  />

                  {/* Clip index pill (top-left) */}
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] font-mono pointer-events-none">
                    #{clip.index} · {clip.title?.slice(0, 22) || 'Untitled'}
                  </div>

                  {/* Time / duration overlay (bottom-right) — shows preview
                      progress so user can see how long the trimmed clip is. */}
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[11px] font-mono pointer-events-none">
                    {formatTime(Math.max(0, playheadSec - clip.start_time))} <span className="text-white/55">/ {formatTime(clip.duration)}</span>
                  </div>

                  {/* Inline PIP boxes — overlaid on the composited preview;
                      drag/resize to retune crop boxes when PIP is selected. */}
                  {clip.edits?.layout === 'pip' && (
                    <PipBoxOverlay
                      config={clip.edits.pipConfig ?? DEFAULT_PIP_CONFIG}
                      onChange={(c) => updateEdits({ pipConfig: c })}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-text-muted text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading video…
                </div>
              )}
            </div>
          </div>

          {/* Play controls — drive the Remotion player via state-backed ref */}
          <div className="flex items-center justify-center gap-3 animate-rise" style={{ animationDelay: '90ms' }}>
            <button
              onClick={() => {
                if (!player) return;
                if (isPlaying) player.pause();
                else player.play();
              }}
              disabled={!player}
              className="w-10 h-10 rounded-full bg-white text-black hover:bg-accent-hover flex items-center justify-center shadow-soft disabled:opacity-50"
            >
              {isPlaying
                ? <Pause className="w-4 h-4" fill="currentColor" />
                : <Play className="w-4 h-4" fill="currentColor" />}
            </button>
            <button
              onClick={() => {
                player?.pause();
                player?.seekTo(0);
                setPlayheadSec(clip.start_time);
              }}
              disabled={!player}
              className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/8 disabled:opacity-30"
              title="Restart clip"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline */}
          <div className="animate-rise" style={{ animationDelay: '130ms' }}>
            <ClipTimeline
              clip={clip}
              playheadSec={playheadSec}
              cutRanges={clip.edits?.cutRanges}
              selectedBrollId={selectedBrollId}
              onSelectBroll={setSelectedBrollId}
              onSeek={seekToSrcSec}
              onTrim={(s, e) => {
                if (!clip) return;
                updateClip(clip.clip_id, { start_time: s, end_time: e }).catch(console.error);
              }}
              onBrollChange={(brolls) => updateEdits({ brolls: brolls.length ? brolls : undefined })}
              onBrollAdd={async () => {
                if (!project?.project_id) return;
                const file = await pickVideoFile();
                if (!file) return;
                const newItem = await uploadBrollFile(project.project_id, clip.clip_id, file, playheadSec, clip);
                if (!newItem) return;
                const all = [...(clip.edits?.brolls ?? []), newItem];
                updateEdits({ brolls: all });
                setSelectedBrollId(newItem.id);
              }}
              videoDurationSec={videoDuration}
              titleLabel={clip.edits?.customTitle ?? clip.title}
              musicLabel={(project.music_tracks ?? []).find((t) => t.selected)?.filename ?? null}
              logoLabel={project.logo_config?.filename ?? null}
            />
          </div>
        </div>

        {/* Right: tools */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
          <ToolsPanel
            clip={clip}
            updateClip={(patch) => updateClip(clip.clip_id, patch).catch(console.error)}
            updateEdits={updateEdits}
            onPickLayout={handlePickLayout}
            selectedBroll={(clip.edits?.brolls ?? []).find((b) => b.id === selectedBrollId) ?? null}
            onReplaceBroll={async (b) => {
              if (!project?.project_id) return;
              const file = await pickVideoFile();
              if (!file) return;
              const updated = await uploadBrollFile(project.project_id, clip.clip_id, file, b.startSec, clip, b.endSec - b.startSec);
              if (!updated) return;
              updateEdits({
                brolls: (clip.edits?.brolls ?? []).map((x) => (x.id === b.id ? { ...x, fileId: updated.fileId, label: updated.label } : x)),
              });
            }}
          />
        </div>
      </div>

      {/* Layout editor modal — opens when user picks a non-Standard layout. */}
      {editingLayout && (
        <LayoutEditorModal
          open
          layout={editingLayout}
          videoUrl={videoUrl}
          previewSec={clip.start_time}
          sourceAspect={sourceAspect}
          outputAspect={outputAspect}
          initialCrops={clip.edits?.regionCrops as Rect01[] | undefined}
          onApply={(crops) => {
            updateEdits({ regionCrops: crops });
            setEditingLayout(null);
          }}
          onClose={() => setEditingLayout(null)}
        />
      )}
    </div>
  );
}

// ─── Clip selector strip ──────────────────────────────────────────────

function ClipSelector({
  clips, selectedId, videoOpfsId, onSelect,
}: {
  clips: ClipData[]; selectedId: string; videoOpfsId?: string; onSelect: (id: string) => void;
}) {
  const idx = clips.findIndex((c) => c.clip_id === selectedId);
  const prev = clips[idx - 1];
  const next = clips[idx + 1];
  return (
    <div className="rounded-2xl glass p-2 flex items-center gap-2 animate-rise hairline-top" style={{ animationDelay: '30ms' }}>
      <button
        disabled={!prev}
        onClick={() => prev && onSelect(prev.clip_id)}
        className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 flex items-center gap-2 overflow-x-auto">
        {clips.map((c) => {
          const isActive = c.clip_id === selectedId;
          return (
            <button
              key={c.clip_id}
              onClick={() => onSelect(c.clip_id)}
              className={cn(
                'flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl border shrink-0',
                isActive
                  ? 'bg-white/12 border-white/30 shadow-soft'
                  : 'bg-white/4 border-white/8 hover:bg-white/8 hover:border-white/15',
              )}
            >
              <ClipThumbnail
                fileId={videoOpfsId}
                timeSec={c.start_time + Math.min(2, c.duration / 2)}
                className="w-12 aspect-video rounded-md overflow-hidden ring-1 ring-white/10"
              />
              <div className="text-left">
                <div className="text-[11px] font-medium text-text leading-tight truncate max-w-[140px]">
                  #{c.index} · {c.title || 'Untitled'}
                </div>
                <div className="text-[9px] text-text-dim font-mono leading-tight">
                  {c.duration.toFixed(0)}s
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button
        disabled={!next}
        onClick={() => next && onSelect(next.clip_id)}
        className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Right tools panel ────────────────────────────────────────────────

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Default)' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Courier New', label: 'Courier New' },
] as const;

function ToolsPanel({
  clip, updateClip, updateEdits, onPickLayout, selectedBroll, onReplaceBroll,
}: {
  clip: ClipData;
  updateClip: (patch: Partial<ClipData>) => void;
  updateEdits: (patch: Partial<ClipEdits>) => void;
  onPickLayout: (layout: ClipEdits['layout']) => void;
  selectedBroll: ClipBroll | null;
  onReplaceBroll: (b: ClipBroll) => Promise<void>;
}) {
  const customTitle = clip.edits?.customTitle ?? clip.title;
  const layout = clip.edits?.layout ?? 'standard';

  return (
    <>
      {/* Title editor */}
      <Section icon={Type} label="Title">
        <input
          type="text"
          value={customTitle}
          onChange={(e) => {
            const v = e.target.value;
            if (v === clip.title) {
              // Title back to original — drop the override.
              updateEdits({ customTitle: undefined });
            } else {
              updateEdits({ customTitle: v });
            }
          }}
          placeholder="Clip title…"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:border-white/30"
        />
        <div className="flex items-center justify-between gap-2">
          <select
            value={clip.edits?.titleFont ?? FONT_OPTIONS[0].value}
            onChange={(e) => updateEdits({ titleFont: e.target.value })}
            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-text text-xs focus:outline-none"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
          {clip.edits?.customTitle && (
            <button
              onClick={() => updateEdits({ customTitle: undefined })}
              className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-text-muted hover:text-text hover:bg-white/10 text-[11px]"
              title="Restore original title"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </Section>

      {/* Layout picker */}
      <Section icon={LayoutIcon} label="Layout">
        <div className="grid grid-cols-2 gap-2">
          <LayoutChip
            active={layout === 'standard'}
            label="Standard"
            onClick={() => onPickLayout('standard')}
            preview={<div className="w-full h-full rounded bg-white/15" />}
          />
          <LayoutChip
            active={layout === 'pip'}
            label="PIP"
            onClick={() => onPickLayout('pip')}
            preview={
              <div className="relative w-full h-full rounded bg-white/15">
                <div className="absolute top-1 right-1 w-1/3 h-1/4 rounded bg-white/45" />
              </div>
            }
          />
          {/* Gameplay: small top + larger bottom */}
          <LayoutChip
            active={layout === 'gameplay'}
            label="Gameplay"
            onClick={() => onPickLayout('gameplay')}
            preview={
              <div className="w-full h-full rounded overflow-hidden flex flex-col gap-0.5">
                <div className="h-[36%] bg-white/35" />
                <div className="flex-1 bg-white/15" />
              </div>
            }
          />
          {/* Split 2 (vertical divider — left | right) */}
          <LayoutChip
            active={layout === 'split-2v'}
            label="Split 2"
            onClick={() => onPickLayout('split-2v')}
            preview={
              <div className="w-full h-full rounded overflow-hidden flex flex-row gap-0.5">
                <div className="flex-1 bg-white/30" />
                <div className="flex-1 bg-white/15" />
              </div>
            }
          />
          {/* Split 3 (three vertical columns) */}
          <LayoutChip
            active={layout === 'split-3'}
            label="Split 3"
            onClick={() => onPickLayout('split-3')}
            preview={
              <div className="w-full h-full rounded overflow-hidden flex flex-row gap-0.5">
                <div className="flex-1 bg-white/30" />
                <div className="flex-1 bg-white/15" />
                <div className="flex-1 bg-white/30" />
              </div>
            }
          />
          {/* Split 4 (2x2 grid) */}
          <LayoutChip
            active={layout === 'split-4'}
            label="Split 4"
            onClick={() => onPickLayout('split-4')}
            preview={
              <div className="w-full h-full rounded overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5">
                <div className="bg-white/30" />
                <div className="bg-white/15" />
                <div className="bg-white/20" />
                <div className="bg-white/35" />
              </div>
            }
            comingSoon
          />
        </div>
        <p className="text-[10px] text-text-dim mt-2 leading-relaxed">
          All layouts render. Split &amp; Gameplay use auto crops of the source
          (left/right halves, grid quarters, face-cam on top); tunable
          per-region crops are a future enhancement.
        </p>
      </Section>

      {/* Selected B-roll details */}
      <Section icon={FileVideo} label={selectedBroll ? 'Selected B-roll' : 'B-roll'}>
        {selectedBroll ? (
          <div className="space-y-2">
            <input
              type="text"
              value={selectedBroll.label ?? ''}
              onChange={(e) => {
                const all = (clip.edits?.brolls ?? []).map((x) =>
                  x.id === selectedBroll.id ? { ...x, label: e.target.value } : x,
                );
                updateEdits({ brolls: all });
              }}
              placeholder="Label"
              className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-text text-xs focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2 text-[10px] text-text-dim font-mono">
              <div>
                <p className="uppercase tracking-wider text-text-dim mb-0.5">Start</p>
                <p className="text-text-muted">{selectedBroll.startSec.toFixed(2)}s</p>
              </div>
              <div>
                <p className="uppercase tracking-wider text-text-dim mb-0.5">End</p>
                <p className="text-text-muted">{selectedBroll.endSec.toFixed(2)}s</p>
              </div>
            </div>
            <button
              onClick={() => onReplaceBroll(selectedBroll)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-text text-[11px] font-medium border border-white/10"
            >
              <Upload className="w-3 h-3" />
              Replace file
            </button>
            <button
              onClick={() => {
                updateEdits({
                  brolls: (clip.edits?.brolls ?? []).filter((x) => x.id !== selectedBroll.id),
                });
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/15 hover:bg-error/25 text-error text-[11px] font-medium border border-error/25"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-text-dim leading-relaxed">
            Click a B-roll chip on the timeline to edit its details. Add new ones via the
            <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-text-muted text-[10px]">
              + B-roll
            </span>
            button.
          </p>
        )}
      </Section>

      {/* Edit summary */}
      <Section icon={ListChecks} label="Edits">
        <SummaryRow
          label="Words disabled"
          value={(clip.edits?.cutRanges ?? []).length ? `${(clip.edits!.cutRanges!.length)} ranges` : 'None'}
        />
        <SummaryRow
          label="B-roll items"
          value={(clip.edits?.brolls ?? []).length ? `${clip.edits!.brolls!.length}` : 'None'}
        />
        <SummaryRow
          label="Title overridden"
          value={clip.edits?.customTitle ? 'Yes' : 'No'}
        />
        {(clip.edits?.cutRanges?.length || clip.edits?.brolls?.length || clip.edits?.customTitle || clip.edits?.layout || clip.edits?.titleFont) && (
          <button
            onClick={() => {
              // Explicitly overwrite with an empty edits object so the IDB
              // merge in dbUpdateClip can never leave stale sub-fields behind.
              updateClip({ edits: {} });
            }}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-muted hover:text-text text-[11px] border border-white/8"
            title="Clear all transcript cuts, B-rolls, title overrides, layout, font"
          >
            <RotateCcw className="w-3 h-3" />
            Reset edits
          </button>
        )}
      </Section>
    </>
  );
}

function Section({
  icon: Icon, label, children,
}: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl glass p-4 hairline-top space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-white/8 border border-white/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-text/85" strokeWidth={1.75} />
        </div>
        <span className="text-[10px] font-semibold text-text-dim uppercase tracking-[0.15em]">{label}</span>
      </div>
      {children}
    </div>
  );
}

function LayoutChip({
  active, label, onClick, preview, comingSoon,
}: {
  active: boolean; label: string; onClick: () => void; preview: React.ReactNode; comingSoon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border p-2 text-left transition-all',
        active
          ? 'bg-white/12 border-white/30 shadow-soft'
          : 'bg-white/4 border-white/8 hover:bg-white/8 hover:border-white/15',
      )}
    >
      <div className="aspect-video rounded-lg overflow-hidden mb-1.5 bg-black/30 p-1">
        {preview}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-text">{label}</span>
        {comingSoon && (
          <span className="text-[8px] uppercase tracking-wider text-text-dim border border-white/10 rounded px-1 py-px">
            Soon
          </span>
        )}
      </div>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-text-dim">{label}</span>
      <span className="text-text-muted font-mono">{value}</span>
    </div>
  );
}

// ─── Empty state shell ───────────────────────────────────────────────

function EmptyEdit({
  icon: Icon, title, body, cta,
}: {
  icon: React.ElementType; title: string; body: string; cta?: { label: string; onClick: () => void };
}) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="rounded-2xl glass p-10 text-center max-w-md animate-rise hairline-top">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl glass flex items-center justify-center">
          <Icon className="w-6 h-6 text-text/85" strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-semibold text-text mb-1">{title}</h3>
        <p className="text-sm text-text-muted mb-5">{body}</p>
        {cta && (
          <button
            onClick={cta.onClick}
            className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-accent-hover text-sm font-medium shadow-soft"
          >
            {cta.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function pickVideoFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Sensible default PIP layout — content on top, speaker bottom-center. */
const DEFAULT_PIP_CONFIG: PIPConfig = {
  contentBox: { x: 0.5, y: 0.25, width: 1, height: 0.5 },
  speakerBox: { x: 0.5, y: 0.78, width: 0.7, height: 0.42 },
  splitRatio: 0.5,
};

/* ─── Inline PIP boxes overlaid on the live preview ───────────────────────
 *
 * Two semi-transparent rectangles you can drag/resize. Each represents an
 * OUTPUT region (the rendered composition's content + speaker boxes). On
 * release we persist the new config to clip.edits.pipConfig.
 *
 * Coordinates are normalized to the preview container — width/height are
 * fractions of the container, x/y mark the CENTER of the box (matching
 * PIPBox conventions used by the canvas + Remotion compositions). */
function PipBoxOverlay({
  config, onChange,
}: { config: PIPConfig; onChange: (c: PIPConfig) => void }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <PipBox
        box={config.contentBox}
        label="Content"
        onChange={(b) => onChange({ ...config, contentBox: b })}
      />
      <PipBox
        box={config.speakerBox}
        label="Speaker"
        onChange={(b) => onChange({ ...config, speakerBox: b })}
      />
    </div>
  );
}

type PipBoxData = { x: number; y: number; width: number; height: number };

function PipBox({
  box, label, onChange,
}: { box: PipBoxData; label: string; onChange: (b: PipBoxData) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | { mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; original: PipBoxData }>(null);

  useEffect(() => {
    if (!drag) return;
    const parent = ref.current?.parentElement?.parentElement; // .relative preview container
    if (!parent) return;
    const onMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      const o = drag.original;
      let next: PipBoxData = { ...o };
      if (drag.mode === 'move') {
        next.x = clamp01(o.x + dx);
        next.y = clamp01(o.y + dy);
      } else {
        // For resize, dx/dy from anchor (the opposite corner stays fixed).
        const signX = drag.mode.endsWith('e') ? +1 : -1;
        const signY = drag.mode.startsWith('s') ? +1 : -1;
        const newW = Math.max(0.1, Math.min(1, o.width + signX * dx * 2));
        const newH = Math.max(0.1, Math.min(1, o.height + signY * dy * 2));
        next.width = newW;
        next.height = newH;
      }
      onChange(next);
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = drag.mode === 'move' ? 'grabbing' :
      drag.mode === 'nw' || drag.mode === 'se' ? 'nwse-resize' : 'nesw-resize';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [drag, onChange]);

  // PIPBox.x/y is the CENTER, width/height are fractions of OUTPUT.
  const left = (box.x - box.width / 2) * 100;
  const top = (box.y - box.height / 2) * 100;
  const widthPct = box.width * 100;
  const heightPct = box.height * 100;

  const startDrag = (mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ mode, startX: e.clientX, startY: e.clientY, original: { ...box } });
  };

  return (
    <div
      ref={ref}
      onPointerDown={startDrag('move')}
      className="absolute border-2 border-white/80 ring-1 ring-black/40 rounded-md bg-white/5 cursor-grab active:cursor-grabbing pointer-events-auto"
      style={{
        left: `${left}%`, top: `${top}%`,
        width: `${widthPct}%`, height: `${heightPct}%`,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.0)',
      }}
    >
      <span className="absolute -top-5 left-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white text-black font-semibold">{label}</span>
      {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
        <div
          key={corner}
          onPointerDown={startDrag(corner)}
          className={cn(
            'absolute w-3 h-3 rounded-sm bg-white border border-black/40 shadow-soft',
            corner === 'nw' && 'top-[-6px] left-[-6px] cursor-nwse-resize',
            corner === 'ne' && 'top-[-6px] right-[-6px] cursor-nesw-resize',
            corner === 'sw' && 'bottom-[-6px] left-[-6px] cursor-nesw-resize',
            corner === 'se' && 'bottom-[-6px] right-[-6px] cursor-nwse-resize',
          )}
        />
      ))}
    </div>
  );
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

async function uploadBrollFile(
  projectId: string,
  clipId: string,
  file: File,
  startSec: number,
  clip: ClipData,
  presetLength?: number,
): Promise<ClipBroll | null> {
  try {
    const { opfsWriteFile } = await import('@/services/opfs');
    const { dbRegisterFile } = await import('@/services/db');
    const fileId = `${projectId}_broll_${clipId}_${Date.now()}`;
    await opfsWriteFile(fileId, file);
    await dbRegisterFile({
      file_id: fileId,
      filename: file.name,
      file_type: 'video' as 'video',
      size_bytes: file.size,
      opfs_id: fileId,
      project_id: projectId,
    });
    const length = presetLength ?? 3;
    const startClamped = Math.max(clip.start_time, Math.min(clip.end_time - length, startSec));
    return {
      id: `broll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      startSec: startClamped,
      endSec: startClamped + length,
      fileId,
      label: file.name,
    };
  } catch (err) {
    console.error('B-roll upload failed:', err);
    return null;
  }
}

