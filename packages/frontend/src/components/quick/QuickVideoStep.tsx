import { useEffect, useRef, useState } from 'react';
import { AudioLines, Captions, Check, Film, HardDrive, Layers, Loader2, RectangleVertical, Upload, X } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { OpfsQuotaError } from '@/services/opfs';
import { cn } from '@/lib/cn';
import type { Project } from '@/types';

const VIDEO_ACCEPT = '.mp4,.mkv,.mov,.avi,.webm,.m4v';

export function QuickVideoStep({
  project,
  onUploaded,
  onBusyChange,
}: {
  project: Project | null;
  onUploaded: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const setFile = useProjectStore((s) => s.setFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { onBusyChange?.(uploading); return () => onBusyChange?.(false); }, [uploading, onBusyChange]);

  const file = project?.video_file;

  const importVideo = async (candidate: File) => {
    const isVideo = candidate.type.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm|m4v)$/i.test(candidate.name);
    if (!isVideo) {
      setError('Choose a video file such as MP4, MOV, MKV, AVI, or WEBM.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      await setFile('video', candidate, setProgress);
      await onUploaded();
    } catch (reason) {
      console.error('Quick Mode video import failed:', reason);
      if (reason instanceof OpfsQuotaError) {
        const used = formatBytes(reason.used);
        const quota = reason.quota ? ` of ${formatBytes(reason.quota)}` : '';
        setError(`Browser storage is full (${used}${quota}). Delete an old project and try again.`);
      } else {
        setError(reason instanceof Error ? reason.message : 'The video could not be imported. Try again.');
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const chooseFile = () => inputRef.current?.click();

  return (
    <section className="space-y-4">
      {file ? (
        <div className="quick-panel p-5 sm:p-6">
          <div className="quick-status flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#f5f5f5]">
              <Check className="h-4 w-4" aria-hidden="true" /> Video ready
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-300">
              <HardDrive className="h-3.5 w-3.5" aria-hidden="true" /> Stored locally
            </span>
          </div>
          <div className="mt-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="quick-icon shrink-0">
                <Film className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="quick-kicker">Source recording</p>
                <p className="mt-1.5 break-all text-base font-semibold leading-6 text-white">{file.filename}</p>
              </div>
            </div>
            <button type="button" onClick={chooseFile} disabled={uploading} className="quick-button-secondary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />} Replace video
            </button>
          </div>
          <dl className="quick-panel-soft mt-5 grid grid-cols-2 gap-x-5 gap-y-4 p-4 sm:grid-cols-4">
            <div className="min-w-0"><dt className="text-xs text-zinc-400">File size</dt><dd className="mt-1.5 text-sm font-medium tabular-nums text-zinc-100">{formatBytes(file.size_bytes)}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-zinc-400">Duration</dt><dd className="mt-1.5 text-sm font-medium tabular-nums text-zinc-100">{file.duration ? formatDuration(file.duration) : 'Not detected'}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-zinc-400">Resolution</dt><dd className="mt-1.5 text-sm font-medium tabular-nums text-zinc-100">{file.width && file.height ? `${file.width} × ${file.height}` : 'Not detected'}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-zinc-400">Frame rate</dt><dd className="mt-1.5 text-sm font-medium tabular-nums text-zinc-100">{file.fps ? `${Number(file.fps.toFixed(2))} fps` : 'Not detected'}</dd></div>
          </dl>
          <p className="quick-divider mt-5 pt-4 text-xs leading-5 text-zinc-400">
            Replacing this video resets its captions and clip suggestions. Your original file on disk stays untouched.
          </p>
        </div>
      ) : (
        <div className="quick-panel p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="quick-kicker">Your source</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">Start with the full recording</h3>
              <p className="mt-1.5 text-sm leading-6 text-zinc-400">Bring in a video. Keep the moments that matter.</p>
            </div>
            <span className="quick-chip inline-flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" aria-hidden="true" /> Local import</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
            <button
              type="button"
              onClick={chooseFile}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const dropped = event.dataTransfer.files[0];
                if (dropped) void importVideo(dropped);
              }}
              disabled={uploading}
              className={cn(
                'group flex min-h-[300px] w-full min-w-0 flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f5f5f5] sm:px-8',
                dragging ? 'border-[#f5f5f5]/70 bg-[#f5f5f5]/[.07]' : 'border-white/20 bg-white/[.02] hover:border-[#f5f5f5]/50 hover:bg-white/[.04]',
                uploading && 'cursor-wait opacity-80',
              )}
            >
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[.04] text-[#f5f5f5]">
                {uploading ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" /> : <Film className="h-7 w-7" aria-hidden="true" />}
              </span>
              <span className="text-xl font-semibold tracking-tight text-white">{uploading ? `Importing locally… ${progress}%` : 'Drop your video here'}</span>
              <span className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">{uploading ? 'Keep this tab open while the source is written to browser storage.' : 'Drag a file from your computer, or browse to find it.'}</span>
              {!uploading && <span className="quick-button-primary mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold">Choose video <Upload className="h-4 w-4" aria-hidden="true" /></span>}
              <span className="mt-5 text-xs leading-5 tracking-wide text-zinc-400">MP4 · MOV · MKV · AVI · WEBM · M4V</span>
            </button>
            <aside className="quick-panel-soft flex flex-col justify-center p-5">
              <p className="text-sm font-semibold text-zinc-100">Your next few steps</p>
              <ol className="mt-5 space-y-5">
                {[
                  { icon: HardDrive, title: 'Import the source', text: 'Save a local copy in this browser.' },
                  { icon: AudioLines, title: 'Get the transcript', text: 'Use on-device Whisper, AssemblyAI, or an SRT.' },
                  { icon: Captions, title: 'Make it a clip', text: 'Find moments, style captions, and export.' },
                ].map(({ icon: Icon, title, text }, index) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[.03] text-zinc-300"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    <div className="min-w-0"><p className="text-xs font-semibold leading-5 text-zinc-200"><span className="mr-1.5 font-mono text-zinc-500">0{index + 1}</span>{title}</p><p className="mt-1 text-xs leading-5 text-zinc-400">{text}</p></div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept={VIDEO_ACCEPT} className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void importVideo(selected); }} />

      {uploading && (
        <div className="quick-panel-soft p-4" role="status" aria-live="polite">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs"><span className="text-zinc-300">Saving video to browser storage</span><span className="font-medium tabular-nums text-[#f5f5f5]">{progress}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Video import progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-[#f5f5f5] transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[.08] px-4 py-3 text-sm leading-6 text-error">
          <X className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: HardDrive, title: 'Local file storage', text: 'The video is imported into this browser.' },
          { icon: Layers, title: 'Memory-aware import', text: 'Large files are saved in smaller chunks.' },
          { icon: RectangleVertical, title: 'Ready for your feed', text: 'Choose your framing before you export.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="quick-panel-soft flex items-start gap-3 p-4 sm:flex-col sm:gap-0">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 sm:mt-0" aria-hidden="true" />
            <div><p className="text-xs font-semibold text-zinc-100 sm:mt-3">{title}</p><p className="mt-1 text-xs leading-5 text-zinc-400">{text}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}
