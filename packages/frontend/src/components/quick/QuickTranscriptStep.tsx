import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Captions,
  Check,
  Cloud,
  Cpu,
  Download,
  FileText,
  HardDrive,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { OpfsQuotaError } from '@/services/opfs';
import { cn } from '@/lib/cn';
import type { Project } from '@/types';

type TranscriptionEngine = 'local' | 'assemblyai';

export function QuickTranscriptStep({ project, onCaptionsChanged, onBusyChange }: { project: Project | null; onCaptionsChanged: (options: { preserveWordTimings: boolean }) => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const setFile = useProjectStore((s) => s.setFile);
  const updateCurrentProject = useProjectStore((s) => s.updateCurrentProject);
  const assemblyaiKey = useSettingsStore((s) => s.assemblyaiKey);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const inputRef = useRef<HTMLInputElement>(null);
  const [engine, setEngine] = useState<TranscriptionEngine>(assemblyaiKey ? 'assemblyai' : 'local');
  const [language, setLanguage] = useState('auto');
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; detail?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcript = project?.srt_file;
  useEffect(() => { onBusyChange(uploading || running); return () => onBusyChange(false); }, [uploading, running, onBusyChange]);

  const importSrt = async (file: File) => {
    if (!/\.srt$/i.test(file.name) && file.type !== 'application/x-subrip' && file.type !== 'text/plain') {
      setError('Choose an SRT subtitle file.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { readSrtEntriesFromFile } = await import('@/services/clipDetector');
      if (!(await readSrtEntriesFromFile(file)).length) throw new Error('No timed transcript entries found. Choose a valid SRT file.');
      await setFile('srt', file);
      await onCaptionsChanged({ preserveWordTimings: false });
    } catch (reason) {
      console.error('Quick Mode subtitle import failed:', reason);
      if (reason instanceof OpfsQuotaError) setError('Browser storage is full. Delete an old project and try again.');
      else setError(reason instanceof Error ? reason.message : 'The subtitle file could not be imported.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const generateTranscript = async () => {
    const current = useProjectStore.getState().currentProject;
    if (!current?.video_file?.path || !current.video_file.duration) {
      setError('Import a video with a readable duration before generating a transcript. You can also upload an SRT.');
      return;
    }
    if (engine === 'assemblyai' && !assemblyaiKey) {
      openSettings();
      return;
    }

    setRunning(true);
    setError(null);
    setProgress({ pct: 0, detail: 'Starting transcription' });
    try {
      const onProgress = (value: { pct: number; detail?: string }) => setProgress(value);
      const args = {
        videoOpfsId: current.video_file.path,
        durationSec: current.video_file.duration,
      };

      const result = engine === 'assemblyai'
        ? await (await import('@/services/assemblyTranscribe')).transcribeWithAssemblyAI({ ...args, apiKey: assemblyaiKey, onProgress })
        : await (await import('@/services/whisperService')).transcribeVideo({ ...args, onProgress, language });

      if (!result.words.length) throw new Error('No speech was detected in this video.');

      const label = engine === 'assemblyai' ? 'AI Transcript (AssemblyAI).srt' : 'AI Transcript (Whisper).srt';
      const encoder = new TextEncoder();
      const { opfsWriteBytes } = await import('@/services/opfs');
      const { dbRegisterFile } = await import('@/services/db');
      const srtId = `${current.project_id}_srt_whisper`;
      const wordsId = `${current.project_id}_words`;
      const srtBytes = encoder.encode(result.srtText);
      const wordBytes = encoder.encode(JSON.stringify(result.words));
      await opfsWriteBytes(srtId, srtBytes);
      await opfsWriteBytes(wordsId, wordBytes);
      await dbRegisterFile({ file_id: srtId, filename: label, file_type: 'srt', size_bytes: srtBytes.length, opfs_id: srtId, project_id: current.project_id });
      await dbRegisterFile({ file_id: wordsId, filename: 'whisper-words.json', file_type: 'words', size_bytes: wordBytes.length, opfs_id: wordsId, project_id: current.project_id });
      await updateCurrentProject({
        srt_file: { file_id: srtId, filename: label, file_type: 'srt', size_bytes: srtBytes.length, path: srtId },
        whisper_words: wordsId,
      });
      await onCaptionsChanged({ preserveWordTimings: true });
      setProgress({ pct: 100, detail: 'Transcript ready' });
    } catch (reason) {
      console.error('Quick Mode transcription failed:', reason);
      setError(reason instanceof Error ? reason.message : 'Transcription failed. Try again or upload an SRT.');
    } finally {
      setRunning(false);
    }
  };

  const downloadTranscript = async () => {
    if (!project?.srt_file?.path) return;
    try {
      const { opfsReadFile } = await import('@/services/opfs');
      const file = await opfsReadFile(project.srt_file.path);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = project.srt_file?.filename || 'transcript.srt';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError('The generated transcript is not available to download yet.');
    }
  };

  return (
    <section className="space-y-4">
      {transcript && (
        <div className="quick-status p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="quick-icon shrink-0"><Check className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#f5f5f5]">Transcript ready</p>
                <p className="mt-1 break-all text-sm leading-6 text-zinc-200">{transcript.filename}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <span>{formatTranscriptSize(transcript.size_bytes)}</span>
                  <span>{project?.whisper_words ? 'Word-level timings' : 'Subtitle timings'}</span>
                  <span className="inline-flex items-center gap-1"><HardDrive className="h-3 w-3" aria-hidden="true" /> Saved locally</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => void downloadTranscript()} className="quick-button-secondary inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold sm:flex-none"><Download className="h-4 w-4" aria-hidden="true" /> Download SRT</button>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || running} className="quick-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-4 w-4" aria-hidden="true" /> Replace</button>
            </div>
          </div>
        </div>
      )}

      <div className="quick-panel p-5 sm:p-6">
        <div className="mb-5">
          <p className="quick-kicker">Transcription engine</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">Choose how to create your transcript</h3>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-400">Timed speech helps you find moments and build accurate captions.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <EngineCard
            active={engine === 'local'}
            disabled={running}
            icon={<Cpu className="h-5 w-5" aria-hidden="true" />}
            title="On-device Whisper"
            description="Private and free. The model downloads on first use, then transcribes in this browser."
            detail="Audio stays on this device"
            onClick={() => setEngine('local')}
            badge="Private"
          />
          <EngineCard
            active={engine === 'assemblyai'}
            disabled={running}
            icon={<Cloud className="h-5 w-5" aria-hidden="true" />}
            title="AssemblyAI"
            description="Cloud transcription using your own API key. Audio is sent directly to AssemblyAI."
            detail="Uses your AssemblyAI account"
            onClick={() => setEngine('assemblyai')}
            badge={assemblyaiKey ? 'Connected' : 'Optional'}
          />
        </div>

        {engine === 'local' && (
          <label className="quick-panel-soft mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span><span className="block text-sm font-medium text-zinc-100">Transcript language</span><span className="mt-1 block text-xs leading-5 text-zinc-400">Auto-detect works well for most recordings.</span></span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={running} className="quick-input min-h-11 w-full px-3 py-2 text-sm text-zinc-100 disabled:opacity-50 sm:w-44">
              <option value="auto">Auto detect</option><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="pt">Portuguese</option><option value="hi">Hindi</option><option value="ar">Arabic</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="zh">Chinese</option>
            </select>
          </label>
        )}

        {engine === 'assemblyai' && !assemblyaiKey && (
          <div className="quick-panel-soft mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-medium text-zinc-100">Connect your AssemblyAI account</p><p className="mt-1 text-xs leading-5 text-zinc-400">AssemblyAI needs your own API key. It is stored only in this browser and sent directly to AssemblyAI.</p></div>
            <button type="button" onClick={openSettings} className="quick-button-secondary inline-flex shrink-0 items-center justify-center px-4 py-2.5 text-xs font-semibold">Open Settings</button>
          </div>
        )}

        <div className="quick-divider mt-5 pt-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="quick-icon shrink-0"><AudioLines className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{transcript ? 'Refresh your transcript' : 'Generate a transcript'}</p>
                <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-400">{engine === 'local' ? 'OpenClip will transcribe speech locally and save word timings for accurate clip selection.' : 'OpenClip will send audio to AssemblyAI, then keep the transcript in your local project.'}</p>
                <p className="mt-2 text-xs font-medium text-zinc-300">Selected engine <span className="mx-1.5 text-zinc-600">/</span><span className="text-[#f5f5f5]">{engine === 'local' ? 'On-device Whisper' : 'AssemblyAI'}</span></p>
              </div>
            </div>
            <button type="button" onClick={() => void generateTranscript()} disabled={running || (engine === 'assemblyai' && !assemblyaiKey)} className="quick-button-primary inline-flex w-full shrink-0 items-center justify-center gap-2 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto">
              {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : transcript ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <AudioLines className="h-4 w-4" aria-hidden="true" />}
              {running ? `${Math.round(progress?.pct ?? 0)}%` : transcript ? 'Regenerate transcript' : 'Generate transcript'}
            </button>
          </div>
          {running && (
            <div className="quick-panel-soft mt-4 p-4" role="status" aria-live="polite">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs"><span className="text-zinc-300">{engine === 'local' ? 'Transcribing on this device' : 'Transcribing with AssemblyAI'}</span><span className="font-medium tabular-nums text-[#f5f5f5]">{Math.round(progress?.pct ?? 0)}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Transcription progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress?.pct ?? 0)}><div className="h-full rounded-full bg-[#f5f5f5] transition-all" style={{ width: `${progress?.pct ?? 0}%` }} /></div>
              <p className="mt-2.5 text-xs leading-5 text-zinc-400">{progress?.detail ?? (engine === 'local' ? 'Working locally…' : 'Working with AssemblyAI…')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="quick-panel-soft flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
          <div><p className="text-sm font-medium text-zinc-100">Already have captions?</p><p className="mt-1 text-xs leading-5 text-zinc-400">Import an SRT file to use its existing subtitle timings.</p></div>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || running} className="quick-button-secondary inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />} Upload SRT</button>
      </div>

      <input ref={inputRef} type="file" accept=".srt,text/plain,application/x-subrip" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void importSrt(selected); }} />
      {uploading && <p role="status" className="flex items-center gap-2 px-1 text-xs text-zinc-300"><Captions className="h-4 w-4 text-[#f5f5f5]" aria-hidden="true" /> Importing timed captions into your project…</p>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[.08] px-4 py-3 text-sm leading-6 text-error"><X className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /><span>{error}</span></div>}
    </section>
  );
}

function EngineCard({ active, disabled, icon, title, description, detail, badge, onClick }: { active: boolean; disabled: boolean; icon: React.ReactNode; title: string; description: string; detail: string; badge: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} data-selected={active} className={cn('quick-choice flex h-full min-w-0 flex-col p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f5f5] sm:p-5', disabled && 'cursor-not-allowed opacity-60')}>
      <span className="flex w-full items-center justify-between gap-3">
        <span className="quick-icon shrink-0">{icon}</span>
        <span className="flex items-center gap-2.5"><span className="quick-chip">{badge}</span><span aria-hidden="true" className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', active ? 'border-[#f5f5f5] bg-[#f5f5f5] text-[#1e1e1e]' : 'border-white/25 bg-black/10')}>{active && <Check className="h-3 w-3" strokeWidth={3} />}</span></span>
      </span>
      <span className="mt-4 text-sm font-semibold text-white">{title}</span>
      <span className="mb-4 mt-1.5 text-xs leading-5 text-zinc-400">{description}</span>
      <span className="quick-divider mt-auto block w-full pt-3 text-xs font-medium text-zinc-300">{detail}</span>
    </button>
  );
}

function formatTranscriptSize(bytes: number): string {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
