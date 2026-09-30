import { useEffect, useRef, useState } from 'react';
import { Check, FileJson, Loader2, Scissors, ChevronDown, RotateCcw, X } from 'lucide-react';
import { useClipStore } from '@/stores/clipStore';
import { useProjectStore } from '@/stores/projectStore';
import { AiClipsGenerator } from '@/components/import/AiClipsGenerator';
import { ClipThumbnail } from '@/components/clips/ClipThumbnail';
import { cn } from '@/lib/cn';
import type { ClipData, Project } from '@/types';

export function QuickClipsStep({
  project,
  clips,
  onClipsDetected,
  onContinue,
  onBusyChange,
}: {
  project: Project | null;
  clips: ClipData[];
  onClipsDetected: () => void;
  onContinue: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const detectClips = useClipStore((s) => s.detectClips);
  const loadJsonClips = useClipStore((s) => s.loadJsonClips);
  const setFile = useProjectStore((s) => s.setFile);
  const finderRef = useRef<HTMLDivElement>(null);
  const [minDuration, setMinDuration] = useState(20);
  const [maxDuration, setMaxDuration] = useState(90);
  const [maxClips, setMaxClips] = useState(8);
  const [running, setRunning] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  useEffect(() => { onBusyChange(running || aiBusy); return () => onBusyChange(false); }, [running, aiBusy, onBusyChange]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const previousClips = useRef(clips);

  useEffect(() => {
    // Invalidate applied styling after regeneration, but stay here for review.
    if (previousClips.current !== clips) onClipsDetected();
    previousClips.current = clips;
  }, [clips, onClipsDetected]);

  const autoFind = async () => {
    if (!project?.srt_file?.path) return;
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      await detectClips(project.srt_file.path, { min_duration: minDuration, max_duration: maxDuration, max_clips: maxClips });
      const count = useClipStore.getState().clips.length;
      setNotice(count ? `Found ${count} clips. Review them, then continue to Style.` : 'No clips matched. Try a shorter minimum length or the AI finder.');
    } catch (reason) {
      console.error('Quick Mode clip detection failed:', reason);
      setError(reason instanceof Error ? reason.message : 'Could not find clips from this transcript.');
    } finally {
      setRunning(false);
    }
  };

  const importJson = async (file: File) => {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      await setFile('json', file);
      const current = useProjectStore.getState().currentProject;
      if (!current?.json_file?.path || !current.srt_file?.path) throw new Error('Add a transcript before importing a clip list.');
      await loadJsonClips(current.json_file.path, current.srt_file.path);
    } catch (reason) {
      console.error('Quick Mode JSON import failed:', reason);
      setError(reason instanceof Error ? reason.message : 'Could not load that clip list.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="space-y-5">
      <div ref={finderRef} className="quick-panel scroll-mt-40 p-4 sm:p-6">
        <fieldset disabled={running} className="min-w-0">
        <div className="mb-5"><p className="quick-kicker">Three simple steps</p><h2 className="mt-1 text-lg font-semibold">Find clips with AI</h2>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-text-muted">Free, no API key. Pasting the prompt into an external chatbot shares your transcript with that provider.</p></div>
        {clips.length > 0 && <p className="mb-4 text-xs leading-5 text-text-muted">Loading a new clip list replaces the current suggestions and their edits. Your source video and transcript are kept.</p>}
        <AiClipsGenerator appearance="quick" onContinue={onContinue} continueLabel="Continue to Style" onBusyChange={setAiBusy} />
        <div className="mt-4 border-t border-white/[.07] pt-4">
          <label className="quick-button-secondary inline-flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-xs">
            <FileJson className="h-3.5 w-3.5" /> Import JSON clip list
            <input type="file" aria-label="Import JSON clip list" disabled={running || aiBusy} accept=".json,application/json" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; event.currentTarget.value = ''; if (selected) void importJson(selected); }} />
          </label>
        </div>
        </fieldset>
      </div>
      {clips.length > 0 && <div className="quick-panel p-4 sm:p-6">
        <div className="mb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><span className="quick-icon"><Check className="h-5 w-5" /></span><div><p className="quick-kicker">Your shortlist</p><p className="mt-1 text-lg font-semibold text-white">{clips.length} clips ready</p><p className="mt-1 text-xs text-text-muted">Review the moments. Give them a consistent look in Style.</p></div></div>
             <button type="button" onClick={() => { finderRef.current?.scrollIntoView({ block: 'center' }); }} className="quick-button-secondary px-4 py-2.5 text-xs"><RotateCcw className="h-3.5 w-3.5" /> Find again</button>
          </div>
        </div>
        <div className={cn('grid gap-3', clips.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
          {clips.slice(0, 3).map((clip) => <article key={clip.clip_id} className="quick-panel-soft overflow-hidden">
            <div className="relative">
              <ClipThumbnail fileId={project?.video_file?.file_id} timeSec={clip.start_time + Math.min(1, clip.duration / 2)} className="aspect-video w-full overflow-hidden bg-black/40" />
              <span className="absolute bottom-2 left-2 rounded-md border border-white/15 bg-black/75 px-2 py-1 font-mono text-[10px] text-white">CLIP {String(clip.index).padStart(2, '0')}</span>
              <span className="absolute bottom-2 right-2 rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[10px] text-white">{Math.round(clip.duration)}s</span>
            </div>
            <div className="p-4"><h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">{clip.edits?.customTitle || clip.title || 'Untitled clip'}</h3><p className="mt-2 font-mono text-[10px] text-[#f5f5f5]">{formatTime(clip.start_time)} — {formatTime(clip.end_time)}</p><p className="mt-3 line-clamp-2 text-xs leading-5 text-text-muted">{clip.preview_text || 'Transcript segment ready to style.'}</p></div>
          </article>)}
        </div>
        {clips.length > 3 && <p className="mt-4 text-xs text-text-muted">Showing the first 3 of {clips.length} clips. Review and select the full batch in Export.</p>}
      </div>}


      <details className="quick-panel group p-4 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden"><Scissors className="h-4 w-4" /> Find automatically <span className="quick-chip ml-auto">On-device</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <fieldset disabled={running || aiBusy} className="mt-5 min-w-0">
        <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="quick-kicker">Set your range</p><h2 className="mt-1 text-lg font-semibold text-white">Automatic clip finder</h2><p className="mt-2 text-xs leading-5 text-text-muted">Keep the defaults for a balanced batch, or adjust the range.</p></div><button type="button" onClick={() => void autoFind()} disabled={running || !project?.srt_file} className="quick-button-primary px-4 py-2.5 text-xs">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}{running ? 'Finding clips…' : 'Find clips'}</button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><NumberField label="Number of clips" value={maxClips} min={1} max={50} onChange={setMaxClips} /><NumberField label="Minimum length" value={minDuration} min={5} max={maxDuration} suffix="s" onChange={(value) => setMinDuration(Math.min(value, maxDuration))} /><NumberField label="Maximum length" value={maxDuration} min={minDuration} max={600} suffix="s" onChange={(value) => setMaxDuration(Math.max(value, minDuration))} /></div>
          <p className="mt-4 border-t border-white/[.07] pt-3 text-[11px] leading-5 text-text-dim">This uses your transcript only. It does not upload your video or require an API key.</p>
        </div>
        </fieldset>
      </details>

      {notice && <p className="flex items-center gap-2 text-xs font-medium text-success"><Check className="h-3.5 w-3.5" /> {notice}</p>}
      {error && <p className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[.08] px-3.5 py-3 text-xs text-error"><X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</p>}
    </section>
  );
}

function NumberField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="quick-panel-soft p-4"><span className="block text-xs font-medium text-text-muted">{label}</span><span className="mt-3 flex items-center gap-2"><input aria-label={label} type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="min-h-10 min-w-0 w-full bg-transparent text-2xl font-semibold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />{suffix && <span className="text-sm text-text-dim">{suffix}</span>}</span></label>;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
