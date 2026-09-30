import { useState, useEffect } from 'react';
import {
  Play, Square, CheckCircle2, XCircle, Loader2, RefreshCw, CheckSquare,
  Square as SquareIcon, Layers, Download, Cpu, SlidersHorizontal, Crosshair,
  AudioLines, Film, Captions, Monitor, Settings as SettingsIcon,
  Search, ArrowUpDown, Star, Bookmark,
} from 'lucide-react';
import { useProcessingStore } from '@/stores/processingStore';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import { useClipTemplateStore } from '@/stores/clipTemplateStore';
import { useStyleStore } from '@/stores/styleStore';
import { useSettingsStore } from '@/stores/settingsStore';

import { RePIPModal } from './RePIPModal';
import { ClipThumbnail } from '@/components/clips/ClipThumbnail';
import { dbGetTemplates } from '@/services/db';
import { PODCAST_TEMPLATES, getPodcastTemplate } from '@/data/premadeTemplates';
import { loadTemplateOverride } from '@/lib/templateOverrides';
import { autoTitleColors } from '@/lib/titleColors';
import { cn } from '@/lib/cn';
import type { Template, ClipEdits } from '@/types';

export function ProcessingPanel({ compact = false }: { compact?: boolean }) {
  const {
    isProcessing, clipProgress, completedClips, failedClips, totalClips,
    renderClips, cancelRendering, downloadClip, resumeQueue,
    outputBlobs,
  } = useProcessingStore();
  const project = useProjectStore((s) => s.currentProject);
  const clips = useClipStore((s) => s.clips);
  const updateClip = useClipStore((s) => s.updateClip);
  const { assignments, setClipTemplate } = useClipTemplateStore();

  // Assign a template to a single clip from its dropdown. Podcast templates also
  // stamp the clip's layout + title colors so the render + Edit preview match;
  // saved templates resolve at render time, and "Default" just clears it.
  const assignTemplate = (clip: typeof clips[0], id: string) => {
    setClipTemplate(clip.clip_id, id || null);
    const pod = id ? getPodcastTemplate(id) : undefined;
    if (pod) {
      const edits: ClipEdits = { ...(clip.edits ?? {}), layout: pod.layout };
      if (pod.hideTitle) {
        edits.customTitle = '';
        delete edits.titleColors;
      } else {
        edits.titleColors = autoTitleColors(clip.edits?.customTitle ?? clip.title);
      }
      // Split templates: carry the user's saved box framing (if customized).
      if (pod.layout === 'split-2h' || pod.layout === 'split-2v') {
        const saved = loadTemplateOverride(pod.id)?.regionCrops;
        if (saved && saved.length) edits.regionCrops = saved;
      }
      updateClip(clip.clip_id, { edits }).catch(console.error);
    }
  };
  const { styles, setExportSettings } = useStyleStore();
  const { pexelsKey, pixabayKey, openSettings } = useSettingsStore();
  const hasBrollKey = !!(pexelsKey || pixabayKey);
  const brollReady = !!project?.whisper_words && hasBrollKey;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [repipClip, setRepipClip] = useState<typeof clips[0] | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'favorite'>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'index' | 'score' | 'duration'>('index');
  const [resumeAvailable, setResumeAvailable] = useState(false);

  // Load templates from IndexedDB
  useEffect(() => {
    dbGetTemplates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('openclip_pending_render_queue');
      const pending = raw ? JSON.parse(raw) as { projectId?: string; clipIds?: string[]; completed?: string[] } : null;
      setResumeAvailable(!!pending && pending.projectId === project?.project_id && (pending.clipIds?.length ?? 0) > (pending.completed?.length ?? 0));
    } catch { setResumeAvailable(false); }
  }, [project?.project_id, isProcessing]);

  useEffect(() => {
    if (clips.length > 0) {
      setSelectedClips(new Set(clips.map((c) => c.clip_id)));
    }
  }, [clips.length]);

  const hasVideo = !!project?.video_file;

  const handleStart = async () => {
    if (!project || selectedClips.size === 0) return;
    const clipIds = [...selectedClips];
    await renderClips(clipIds);
  };

  const handleRerender = async (clipId: string) => {
    await renderClips([clipId]);
  };

  const handleRepip = async (clipId: string, override: { pip?: any; subtitle?: any; title?: any }) => {
    await renderClips([clipId], { [clipId]: override });
  };

  const toggleClipSelected = (clipId: string) => {
    setSelectedClips((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedClips.size === clips.length) setSelectedClips(new Set());
    else setSelectedClips(new Set(clips.map((c) => c.clip_id)));
  };

  const overallPercent = totalClips > 0
    ? ((completedClips + failedClips) / totalClips) * 100
    : 0;

  const allSelected = selectedClips.size === clips.length;
  const visibleClips = [...clips]
    .filter((clip) => filter === 'all' || (filter === 'favorite' ? !!clip.favorite : clip.status === filter))
    .filter((clip) => !query.trim() || `${clip.title} ${clip.preview_text}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sortBy === 'score' ? b.score - a.score : sortBy === 'duration' ? b.duration - a.duration : a.index - b.index);

  if (!hasVideo) {
    return (
      <div className="rounded-2xl glass p-10 text-center text-text-muted text-sm animate-rise">
        Import a video file first to process clips.
      </div>
    );
  }

  // ─── Status copy for the Queue Status panel ────────────────────────────
  const queueStatus = isProcessing
    ? { label: 'Processing', tone: 'bg-warning/15 text-warning border-warning/30' }
    : completedClips > 0 || failedClips > 0
      ? { label: 'Complete', tone: 'bg-success/15 text-success border-success/30' }
      : { label: 'Ready', tone: 'bg-success/15 text-success border-success/30' };

  return (
    <div className={cn('grid gap-6 items-start', compact ? 'quick-processing xl:grid-cols-[minmax(0,1fr)_270px]' : 'lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]')}>
      {/* ─── Left Column: Active Queue ───────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        {resumeAvailable && !isProcessing && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2.5 text-xs text-text-muted">
            <span>An unfinished render queue is available from this project.</span>
            <button onClick={() => { void resumeQueue(); setResumeAvailable(false); }} className="rounded-lg bg-white px-3 py-1.5 font-semibold text-black hover:bg-accent-hover">Resume queue</button>
          </div>
        )}
        {/* ─── Overall progress (only while processing) ─────────────────── */}
        {isProcessing && (
          <div className="rounded-2xl glass-subtle p-4 animate-rise">
            <div className="flex justify-between text-xs text-text-muted mb-2">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Overall Progress</span>
              </span>
              <span className="font-mono">{completedClips + failedClips} / {totalClips}</span>
            </div>
            <div className="relative h-2 bg-white/8 rounded-full overflow-hidden progress-shimmer">
              <div
                className="h-full bg-white transition-all duration-500 rounded-full"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* ─── Active Queue ─────────────────────────────────────────────── */}
        {clips.length > 0 && (
          <section className={cn('rounded-2xl p-5 animate-rise', compact ? 'quick-panel-soft' : 'glass hairline-top')} style={{ animationDelay: '140ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className={cn('w-2 h-2 rounded-full', compact ? 'bg-[#9aefc1]' : 'bg-white/80 animate-soft-pulse')} />
                <h3 className="text-sm font-semibold text-text tracking-tight">Active Queue</h3>
              </div>
              {!isProcessing && (
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text"
                >
                  {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <SquareIcon className="w-3.5 h-3.5" />}
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-white/8 bg-white/[.035] px-2.5 py-1.5 text-xs text-text-muted">
                <Search className="h-3.5 w-3.5" />
                <input aria-label="Search clips" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clips" className="min-w-0 flex-1 bg-transparent text-xs text-text outline-none placeholder:text-text-dim" />
              </label>
              <select aria-label="Filter clips" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-lg border border-white/8 bg-white/[.035] px-2.5 py-1.5 text-xs text-text">
                <option value="all">All clips</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="favorite">Favorites</option>
              </select>
              <label className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[.035] px-2.5 py-1.5 text-xs text-text-muted"><ArrowUpDown className="h-3 w-3" /><select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="bg-transparent text-xs text-text outline-none"><option value="index">Original order</option><option value="score">Highest score</option><option value="duration">Longest first</option></select></label>
            </div>

            {(completedClips > 0 || failedClips > 0) && (
              <div className="flex items-center gap-4 mb-3 text-xs">
                <span className="text-success flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {completedClips} done
                </span>
                {failedClips > 0 && (
                  <span className="text-error flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> {failedClips} failed
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2">
              {visibleClips.map((clip, idx) => {
                const progress = clipProgress[clip.clip_id];
                const pct = progress?.percent ?? 0;
                const eta = progress?.eta ?? 0;
                const phase = progress?.phase ?? '';
                const currFps = progress?.currentFps ?? 0;
                const status = progress?.phase === 'done' ? 'completed'
                  : progress?.phase === 'failed' ? 'failed'
                  : progress?.percent != null ? 'processing'
                  : clip.status;
                const isSelected = selectedClips.has(clip.clip_id);
                const isCompleted = status === 'completed';
                const isFailed = status === 'failed';
                const isActive = status === 'processing';
                const hasOutput = !!outputBlobs[clip.clip_id];
                const assignedTemplate = assignments[clip.clip_id] ?? null;

                return (
                  <div
                    key={clip.clip_id}
                    className={cn(
                      'group rounded-xl glass-subtle p-3 transition-all duration-300',
                      isActive && 'ring-1 ring-white/15 shadow-soft',
                      !isSelected && !isActive && 'opacity-60',
                    )}
                    style={{ animationDelay: `${160 + idx * 30}ms` }}
                  >
                    <div className={cn('flex items-start gap-3', compact && 'quick-queue-row')}>
                      {!isProcessing && (
                        <input
                          type="checkbox"
                          aria-label={`Select clip ${clip.index}`}
                          checked={isSelected}
                          onChange={() => toggleClipSelected(clip.clip_id)}
                          className="mt-1 w-4 h-4 rounded accent-white shrink-0"
                        />
                      )}

                      <ClipThumbnail
                        fileId={project?.video_file?.file_id}
                        timeSec={clip.start_time + Math.min(2, clip.duration / 2)}
                        className="w-24 aspect-video self-start rounded-lg overflow-hidden ring-1 ring-white/8 shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-text-dim">#{clip.index}</span>
                            <span className="text-sm text-text font-medium truncate">{clip.title || 'Untitled'}</span>
                            <button
                              onClick={() => updateClip(clip.clip_id, { favorite: !clip.favorite })}
                              className="shrink-0 rounded p-0.5 text-text-dim hover:text-warning"
                              title={clip.favorite ? 'Remove favorite' : 'Favorite clip'}
                              aria-label={clip.favorite ? 'Remove favorite' : 'Favorite clip'}
                            >
                              {compact ? <Bookmark className={cn('h-4 w-4', clip.favorite && 'fill-[#9aefc1] text-[#9aefc1]')} /> : <Star className={cn('h-3.5 w-3.5', clip.favorite && 'fill-warning text-warning')} />}
                            </button>
                            <span className="text-[10px] text-text-dim shrink-0 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8">
                              {clip.duration.toFixed(0)}s
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isActive && (
                              <>
                                <Loader2 className="w-3.5 h-3.5 text-text/80 animate-spin" />
                                {currFps > 0 && <span className="text-[10px] text-text-dim font-mono">{currFps}fps</span>}
                                {eta > 0 && <span className="text-[10px] text-text-muted font-mono">ETA: {Math.ceil(eta)}s</span>}
                              </>
                            )}
                            {isCompleted && <CheckCircle2 className="w-4 h-4 text-success" />}
                            {isFailed && <XCircle className="w-4 h-4 text-error" />}
                          </div>
                        </div>

                        {clip.scoreReasons && clip.scoreReasons.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {clip.scoreReasons.slice(0, 3).map((reason) => (
                              <span key={reason} className="rounded-md border border-white/8 bg-white/[.035] px-1.5 py-0.5 text-[9px] text-text-dim" title="Why this clip was selected">
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Phase label */}
                        {phase && isActive && (
                          <p className="text-[10px] text-text-dim mb-1.5 capitalize">{phase}…</p>
                        )}

                        {/* Template + action buttons */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <select
                            aria-label={`Template for clip ${clip.index}`}
                            value={assignedTemplate ?? ''}
                            onChange={(e) => assignTemplate(clip, e.target.value)}
                            disabled={isActive}
                            className="min-w-0 flex-1 max-w-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-text text-xs focus:outline-none focus:border-white/30 disabled:opacity-50"
                          >
                            <option value="">Default (Project Styles)</option>
                            <optgroup label="Podcast">
                              {PODCAST_TEMPLATES.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </optgroup>
                            {templates.length > 0 && (
                              <optgroup label="Saved">
                                {templates.map((t) => (
                                  <option key={t.template_id} value={t.template_id}>
                                    {t.name}{t.layout === 'pip' ? ' (PIP)' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>

                          {(isCompleted || isFailed) && !isProcessing && (
                            <ActionPill
                              onClick={() => handleRerender(clip.clip_id)}
                              tone="neutral"
                              icon={<RefreshCw className="w-3 h-3" />}
                            >
                              {isFailed ? 'Retry' : 'Re-render'}
                            </ActionPill>
                          )}

                          {!isActive && !isProcessing && (
                            <ActionPill
                              onClick={() => setRepipClip(clip)}
                              tone="neutral"
                              icon={<Layers className="w-3 h-3" />}
                            >
                              Customize
                            </ActionPill>
                          )}

                          {hasOutput && (
                            <ActionPill
                              onClick={() => downloadClip(clip.clip_id)}
                              tone="success"
                              icon={<Download className="w-3 h-3" />}
                            >
                              Save
                            </ActionPill>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div
                          className={cn(
                            'relative h-1.5 bg-white/8 rounded-full overflow-hidden',
                            isActive && 'progress-shimmer',
                          )}
                        >
                          <div
                            className={cn(
                              'h-full transition-all duration-300 rounded-full',
                              isCompleted ? 'bg-success' :
                              isFailed ? 'bg-error' :
                              isActive ? 'bg-white' : 'bg-white/15'
                            )}
                            style={{ width: `${isCompleted ? 100 : pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ─── Right Column: Batch Options + Queue Status ────────────── */}
      <div className={cn('flex min-w-0 flex-col gap-6', compact ? 'xl:sticky xl:top-28' : 'sticky top-6')}>
        {!compact && (
          <section
            className="rounded-2xl glass p-5 animate-rise hairline-top"
            style={{ animationDelay: '40ms' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4 text-text/90" strokeWidth={1.75} />
                </div>
                <h3 className="text-sm font-semibold text-text tracking-tight">Batch Processing Options</h3>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] text-text-dim uppercase tracking-wider">
                <Cpu className="w-3 h-3" />
                On-device
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <OptionToggle
                icon={<Crosshair className="w-3.5 h-3.5" />}
                title="Auto-center speaker"
                subtitle="Face-tracking optimization"
                checked={styles.export.face_tracking !== false}
                onChange={(v) => setExportSettings({ face_tracking: v })}
                disabled={isProcessing}
              />
              <div role="group" aria-label="Automatic split options" className="space-y-2.5">
                <OptionToggle
                  icon={<Layers className="w-3.5 h-3.5" />}
                  title="Auto-split two faces"
                  subtitle="Splits only sustained, clear two-person shots after frame-by-frame verification. Slower analysis."
                  checked={!!styles.export.auto_split_faces}
                  onChange={(v) => setExportSettings({ auto_split_faces: v })}
                  disabled={isProcessing}
                  extra={
                    <p className="text-[10px] text-text-dim leading-snug">
                      Portrait standard layouts only; manual layouts preserved. Requires frame-accurate MP4/WebCodecs decoding. Uncertain or unsupported frames stay unsplit.
                    </p>
                  }
                />
                <OptionToggle
                  icon={<Monitor className="w-3.5 h-3.5" />}
                  title="Auto-split screen share"
                  subtitle="Detects a corner webcam: shared content above, enlarged speaker below."
                  checked={!!styles.export.auto_split_screen_share}
                  onChange={(v) => setExportSettings({ auto_split_screen_share: v })}
                  disabled={isProcessing}
                  extra={
                    <p className="text-[10px] text-text-dim leading-snug">
                      Strict frame checks leave normal or uncertain footage unchanged. Portrait standard MP4/WebCodecs only; manual layouts preserved. Independent of face tracking and two-face splitting.
                    </p>
                  }
                />
                <div className="ml-4 border-l border-white/8 pl-3">
                  <OptionToggle
                    icon={<Captions className="w-3.5 h-3.5" />}
                    title="Center captions while split"
                    subtitle="Place enabled captions at the seam only during an active split in either mode."
                    checked={!!styles.export.auto_split_center_captions}
                    onChange={(v) => setExportSettings({ auto_split_center_captions: v })}
                    disabled={isProcessing || !(styles.export.auto_split_faces || styles.export.auto_split_screen_share)}
                  />
                </div>
              </div>
              <OptionToggle
                icon={<AudioLines className="w-3.5 h-3.5" />}
                title="Remove silences"
                subtitle={project?.whisper_words ? 'Trim filler words automatically' : 'Generate AI transcript in Import first'}
                checked={!!styles.export.remove_silences && !!project?.whisper_words}
                onChange={(v) => setExportSettings({ remove_silences: v })}
                disabled={isProcessing || !project?.whisper_words}
              />
              <OptionToggle
                icon={<Film className="w-3.5 h-3.5" />}
                title="Add B-roll footage"
                subtitle={
                  !project?.whisper_words
                    ? 'Generate AI transcript in Import first'
                    : !hasBrollKey
                      ? 'Add a free key in Settings'
                      : 'AI-generated stock overlays'
                }
                checked={!!styles.export.broll && brollReady}
                onChange={(v) => setExportSettings({ broll: v })}
                disabled={isProcessing || !brollReady}
                extra={
                  !hasBrollKey && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openSettings(); }}
                      className="text-[10px] text-text/90 underline underline-offset-2 hover:text-text"
                    >
                      Open Settings
                      <SettingsIcon className="inline-block w-2.5 h-2.5 ml-1 -mt-0.5" />
                    </button>
                  )
                }
              />
              <OptionToggle
                icon={<Captions className="w-3.5 h-3.5" />}
                title="Generate Captions"
                subtitle="Dynamic kinetic typography"
                checked={true}
                onChange={() => {}}
                disabled
              />
            </div>
          </section>
        )}

        {/* Queue Status */}
        <section
          className={cn('rounded-2xl p-5 animate-rise flex flex-col', compact ? 'quick-panel-soft' : 'glass hairline-top')}
          style={{ animationDelay: '90ms' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-text-dim uppercase tracking-[0.15em]">
              Queue Status
            </span>
            <span className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border',
              queueStatus.tone,
            )}>
              {queueStatus.label}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-semibold text-text tracking-tight tabular-nums">
              {clips.length}
            </span>
            <span className="text-xs text-text-muted">Clips in queue</span>
          </div>

          {/* Selection vs queue capacity */}
          <div className="mt-2 mb-4">
            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full bg-white/80 transition-all duration-500 rounded-full"
                style={{ width: clips.length ? `${(selectedClips.size / clips.length) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-[10px] text-text-dim mt-1.5">
              {selectedClips.size} of {clips.length} selected
            </p>
          </div>

          <div className="mt-auto pt-3 border-t border-white/8">
            {isProcessing ? (
              <button
                onClick={cancelRendering}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-error/15 hover:bg-error/25 text-error font-medium text-sm border border-error/30"
              >
                <Square className="w-3.5 h-3.5" />
                Cancel Processing
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={clips.length === 0 || selectedClips.size === 0}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all',
                  clips.length === 0 || selectedClips.size === 0
                    ? 'bg-white/8 text-text-dim cursor-not-allowed border border-white/5'
                     : 'bg-white text-black hover:bg-accent-hover shadow-soft',
                  compact && 'quick-button-primary',
                )}
              >
                <Play className="w-3.5 h-3.5" strokeWidth={2.25} fill="currentColor" />
                Process All Clips
              </button>
            )}
          </div>
        </section>
      </div>

      {repipClip && (
        <RePIPModal
          clip={repipClip}
          onClose={() => setRepipClip(null)}
          onApply={handleRepip}
        />
      )}
    </div>
  );
}

/* ─── Toggle row card (icon + title + subtitle + switch) ────────────────── */
function OptionToggle({
  icon, title, subtitle, checked, onChange, disabled, extra,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'group flex items-center gap-3 p-3 rounded-xl glass-subtle border border-white/8 select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/4 hover:border-white/15',
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-white/6 border border-white/8 flex items-center justify-center text-text shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text font-medium leading-tight">{title}</p>
        {subtitle && <p className="text-[11px] text-text-dim leading-snug mt-0.5">{subtitle}</p>}
        {extra && <div className="mt-1">{extra}</div>}
      </div>
      <input
        type="checkbox"
        aria-label={title}
        className="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/* ─── Small action pill button used on each clip row ───────────────────── */
function ActionPill({
  onClick, tone, icon, children,
}: {
  onClick: () => void;
  tone: 'neutral' | 'success';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 border',
        tone === 'success'
          ? 'bg-success/15 text-success border-success/25 hover:bg-success/25'
          : 'bg-white/6 text-text border-white/10 hover:bg-white/12 hover:border-white/20',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
