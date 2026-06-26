import { useState, useEffect } from 'react';
import {
  Play, Square, CheckCircle2, XCircle, Loader2, RefreshCw, CheckSquare,
  Square as SquareIcon, Layers, Download, Cpu, SlidersHorizontal, Crosshair,
  AudioLines, Film, Captions, Settings as SettingsIcon,
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
import { cn } from '@/lib/cn';
import type { Template } from '@/types';

export function ProcessingPanel() {
  const {
    isProcessing, clipProgress, completedClips, failedClips, totalClips,
    renderClips, cancelRendering, downloadClip,
    outputBlobs,
  } = useProcessingStore();
  const project = useProjectStore((s) => s.currentProject);
  const clips = useClipStore((s) => s.clips);
  const { assignments, setClipTemplate } = useClipTemplateStore();
  const { styles, setExportSettings } = useStyleStore();
  const { pexelsKey, pixabayKey, openSettings } = useSettingsStore();
  const hasBrollKey = !!(pexelsKey || pixabayKey);
  const brollReady = !!project?.whisper_words && hasBrollKey;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [repipClip, setRepipClip] = useState<typeof clips[0] | null>(null);

  // Load templates from IndexedDB
  useEffect(() => {
    dbGetTemplates().then(setTemplates).catch(() => {});
  }, []);

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
    <div className="grid lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-6 items-start">
      {/* ─── Left Column: Active Queue ───────────────────────────────── */}
      <div className="space-y-6 min-w-0">
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
          <section className="rounded-2xl glass p-5 animate-rise hairline-top" style={{ animationDelay: '140ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-white/80 animate-soft-pulse" />
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
              {clips.map((clip, idx) => {
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
                    <div className="flex items-start gap-3">
                      {!isProcessing && (
                        <input
                          type="checkbox"
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

                        {/* Phase label */}
                        {phase && isActive && (
                          <p className="text-[10px] text-text-dim mb-1.5 capitalize">{phase}…</p>
                        )}

                        {/* Template + action buttons */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <select
                            value={assignedTemplate ?? ''}
                            onChange={(e) => setClipTemplate(clip.clip_id, e.target.value || null)}
                            disabled={isActive}
                            className="flex-1 max-w-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-text text-xs focus:outline-none focus:border-white/30 disabled:opacity-50"
                          >
                            <option value="">Default (Project Styles)</option>
                            {templates.map((t) => (
                              <option key={t.template_id} value={t.template_id}>
                                {t.name}{t.layout === 'pip' ? ' (PIP)' : ''}
                              </option>
                            ))}
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
      <div className="flex flex-col gap-6 sticky top-6">
        {/* Batch Processing Options */}
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

        {/* Queue Status */}
        <section
          className="rounded-2xl glass p-5 animate-rise hairline-top flex flex-col"
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
