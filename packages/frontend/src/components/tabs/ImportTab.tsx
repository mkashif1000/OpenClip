import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Film, FileText, Upload, Loader2, Check, ArrowRight, Play, Wand2,
  ExternalLink, Youtube, Download, RotateCcw, ShieldCheck, Eye, Type, Music,
  Cpu, Cloud, Sparkles
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import { useStyleStore } from '@/stores/styleStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { LivePreview } from '@/components/styles/LivePreview';
import { MusicPanel } from '@/components/music/MusicPanel';
import { LogoPanel } from '@/components/logo/LogoPanel';
import { AiClipsGenerator } from '@/components/import/AiClipsGenerator';
import { cn } from '@/lib/cn';
import type { MusicTrack, LogoConfig } from '@/types';

type Step = 'video' | 'srt' | 'json' | 'ready';

export function ImportTab() {
  const { currentProject } = useProjectStore();
  const { clips, loadJsonClips } = useClipStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [previewTrack, setPreviewTrack] = useState<MusicTrack | null>(null);
  const [logoConfig, setLogoConfig] = useState<LogoConfig | null>(currentProject?.logo_config || null);
  const [musicBlobUrl, setMusicBlobUrl] = useState<string | null>(null);
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null);
  const [clipNotice, setClipNotice] = useState<string | null>(null);

  const hasVideo = !!currentProject?.video_file;
  const hasSrt = !!currentProject?.srt_file;
  const hasClips = clips.length > 0;

  // 'ready' is gated on actual clips existing — not merely on a JSON file being
  // present — so a JSON that yields no clips keeps the user on the Clips step
  // instead of a dead "All Set".
  const currentStep: Step = !hasVideo ? 'video' : !hasSrt ? 'srt' : !hasClips ? 'json' : 'ready';

  // Auto-recover: if a project already has a JSON + SRT stored but no clips
  // (e.g. uploaded before this fix, or a prior load failed), parse the clips on
  // load instead of forcing the user to re-upload. Runs once per project.
  const projectId = currentProject?.project_id;
  useEffect(() => {
    if (!projectId) return;
    const proj = useProjectStore.getState().currentProject;
    if (!proj?.json_file?.path || !proj?.srt_file?.path) return;
    if (useClipStore.getState().clips.length > 0) return;
    loadJsonClips(proj.json_file.path, proj.srt_file.path).catch((e) =>
      console.error('Auto clip-load from stored JSON failed:', e),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleTrackSelect = async (track: MusicTrack | null) => {
    setPreviewTrack(track);
    if (track?.path) {
      const { opfsGetBlobUrl } = await import('@/services/opfs');
      try {
        const url = await opfsGetBlobUrl(track.path);
        setMusicBlobUrl(url);
      } catch { setMusicBlobUrl(null); }
    } else {
      setMusicBlobUrl(null);
    }
  };

  const handleLogoChange = async (config: LogoConfig | null) => {
    setLogoConfig(config);
    if (config?.file_id) {
      const { opfsGetBlobUrl } = await import('@/services/opfs');
      try {
        const url = await opfsGetBlobUrl(config.file_id);
        setLogoBlobUrl(url);
      } catch { setLogoBlobUrl(null); }
    } else {
      setLogoBlobUrl(null);
    }
  };

  return (
    <div className={cn('mx-auto p-6 lg:p-8', hasVideo ? 'max-w-6xl' : 'max-w-3xl')}>
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 animate-rise">
        <div>
          <h2 className="text-2xl font-semibold text-text tracking-tight mb-1.5">Setup Your Clips</h2>
          <p className="text-sm text-text-muted max-w-xl">
            Three short steps. Everything lives in your browser — no uploads, no servers.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle border border-white/8 text-[11px] text-text-muted shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>100% on-device</span>
        </div>
      </div>

      <div className={cn('gap-6', hasVideo ? 'grid grid-cols-1 lg:grid-cols-3' : '')}>
        {/* ─── Left column: progress + step cards ─────────────────────── */}
        <div className={cn(hasVideo ? 'lg:col-span-2' : '', 'space-y-5')}>
          {/* Progress strip */}
          <div
            className="rounded-2xl glass p-4 animate-rise hairline-top"
            style={{ animationDelay: '40ms' }}
          >
            <ProgressStrip
              steps={[
                { num: 1, label: 'Video', done: hasVideo, active: currentStep === 'video' },
                { num: 2, label: 'Subtitles', done: hasSrt, active: currentStep === 'srt' },
                { num: 3, label: 'Clips', done: hasClips, active: currentStep === 'json' },
                { num: 4, label: 'Process', done: false, active: currentStep === 'ready' },
              ]}
            />
          </div>

          {/* Step 1: Video */}
          {/* Step 1: Video */}
          <VideoSection
            done={hasVideo}
            active={currentStep === 'video'}
            file={currentProject?.video_file}
            // No-op: FileUploadButton (inside VideoSection) already calls setFile.
            // Calling it again here used to write the same multi-GB video to OPFS
            // twice and run two ffmpeg probes back-to-back, which hung / OOMed
            // large uploads silently.
            onUpload={async () => { /* handled by FileUploadButton.setFile */ }}
          />

          {/* Step 2: SRT */}
          <StepCard
            step={2}
            title="Get Subtitles"
            description="Upload an SRT file — or generate one on-device with AI."
            icon={FileText}
            done={hasSrt}
            active={currentStep === 'srt'}
            file={currentProject?.srt_file}
            animDelay="120ms"
          >
            {/* Same fix here — FileUploadButton inside SubtitlesSection handles setFile. */}
            <SubtitlesSection onUploadSrt={async () => { /* handled by FileUploadButton.setFile */ }} />
          </StepCard>

          {/* Step 3: AI clips (free, no key) — with JSON-file fallback */}
          <StepCard
            step={3}
            title="Find Clips with AI"
            description="Free, no API key. Copy a prompt into any chatbot, paste the result back."
            icon={Sparkles}
            done={hasClips}
            active={currentStep === 'json'}
            file={currentProject?.json_file}
            extraInfo={hasClips ? `${clips.length} clips loaded` : undefined}
            animDelay="160ms"
          >
            <div className="w-full space-y-3">
              <AiClipsGenerator />

              {/* Secondary: still allow a raw JSON file upload. */}
              <details className="group">
                <summary className="cursor-pointer text-[11px] text-text-dim hover:text-text-muted select-none">
                  Or upload a JSON file instead
                </summary>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <FileUploadButton
                    accept=".json"
                    fileType="json"
                    label="Choose JSON File"
                    variant="ghost"
                    onUploaded={async () => {
                      setClipNotice(null);
                      const proj = useProjectStore.getState().currentProject;
                      if (!proj?.srt_file?.path) {
                        setClipNotice('Generate or upload subtitles first, then the JSON.');
                        return;
                      }
                      if (!proj?.json_file?.path) return;
                      try {
                        await loadJsonClips(proj.json_file.path, proj.srt_file.path);
                        if (useClipStore.getState().clips.length === 0) {
                          setClipNotice('No clips were found in that JSON. Check its format and try again.');
                        }
                      } catch (err) {
                        console.error('Failed to load clips from JSON:', err);
                        setClipNotice('Could not read that JSON file. Make sure it is valid JSON.');
                      }
                    }}
                  />
                </div>
              </details>
              {clipNotice && (
                <p className="w-full text-xs text-warning mt-1">{clipNotice}</p>
              )}
            </div>
          </StepCard>

          {/* Step 4: Ready */}
          {currentStep === 'ready' && (
            <ReadyCard count={clips.length} onEdit={() => setActiveTab('edit')} onProcess={() => setActiveTab('process')} />
          )}
        </div>

        {/* ─── Right column: live preview + style controls ────────────── */}
        {hasVideo && (
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 space-y-4">
              <SectionCard icon={Eye} label="Live Preview" delay="100ms">
                <LivePreview
                  musicSrc={musicBlobUrl ?? undefined}
                  musicVolume={previewTrack?.volume}
                  logoSrc={logoBlobUrl ?? undefined}
                  logoX={logoConfig?.x}
                  logoY={logoConfig?.y}
                  logoSize={logoConfig?.size}
                  logoOpacity={logoConfig?.opacity}
                />
              </SectionCard>
              <SectionCard icon={Type} label="Subtitle Settings" delay="140ms">
                <SubtitleQuickControls />
              </SectionCard>
              <SectionCard icon={Music} label="Background Music" delay="180ms">
                <MusicPanel onTrackSelect={handleTrackSelect} />
              </SectionCard>
              <div className="rounded-2xl glass p-4 animate-rise hairline-top" style={{ animationDelay: '220ms' }}>
                <LogoPanel onLogoChange={handleLogoChange} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Progress strip ─────────────────────────────────────────────────────

function ProgressStrip({
  steps,
}: {
  steps: Array<{ num: number; label: string; done: boolean; active: boolean }>;
}) {
  // Fraction of the strip filled (number of completed steps / total).
  const completedFrac = steps.filter((s) => s.done).length / (steps.length - 1);

  return (
    <div className="relative">
      {/* Track behind the steps */}
      <div className="absolute left-3 right-3 top-3.5 h-px bg-white/8 rounded-full" />
      <div
        className="absolute left-3 top-3.5 h-px rounded-full bg-white/80 transition-all duration-700"
        style={{ width: `calc((100% - 24px) * ${completedFrac})` }}
      />

      <div className="relative flex items-start justify-between">
        {steps.map((s) => (
          <div key={s.num} className="flex flex-col items-center gap-1.5 min-w-0">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-all duration-300',
                s.done
                  ? 'bg-white text-black border-white shadow-soft'
                  : s.active
                    ? 'bg-white/8 text-text border-white/40 ring-2 ring-white/15 animate-soft-pulse'
                    : 'bg-white/4 text-text-dim border-white/8',
              )}
            >
              {s.done ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : s.num}
            </div>
            <span
              className={cn(
                'text-[11px] font-medium transition-colors',
                s.done ? 'text-text' : s.active ? 'text-text' : 'text-text-dim',
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step card ──────────────────────────────────────────────────────────

function StepCard({
  step, title, description, icon: Icon, done, active, file, extraInfo, animDelay, children,
}: {
  step: number; title: string; description: string; icon: React.ElementType;
  done: boolean; active: boolean;
  file?: { filename: string; size_bytes: number; duration?: number } | null;
  extraInfo?: string;
  animDelay?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl glass p-5 transition-all duration-300 hairline-top animate-rise relative',
        done && 'border border-success/25',
        active && !done && 'ring-1 ring-white/15 shadow-soft',
        !active && !done && 'opacity-50 pointer-events-none',
      )}
      style={{ animationDelay: animDelay }}
    >
      {/* Step number badge — top-right */}
      <div className="absolute top-4 right-4 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/6 border border-white/8 text-text-dim tracking-wider">
        STEP {step}
      </div>

      <div className="flex items-start gap-4 pr-12">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
            done
              ? 'bg-success/12 text-success border-success/25'
              : active
                ? 'bg-white/10 text-text border-white/15'
                : 'bg-white/4 text-text-dim border-white/6',
          )}
        >
          {done ? <Check className="w-5 h-5" strokeWidth={2.25} /> : <Icon className="w-5 h-5" strokeWidth={1.75} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-text mb-1 tracking-tight">{title}</h3>
          <p className="text-xs text-text-muted leading-relaxed mb-3">{description}</p>

          {done && file && <FileChip filename={file.filename} sizeBytes={file.size_bytes} duration={file.duration} />}
          {done && extraInfo && !file && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg glass-subtle border border-success/25 text-xs text-success mb-3">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{extraInfo}</span>
            </div>
          )}

          {(active || done) && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function FileChip({
  filename, sizeBytes, duration,
}: { filename: string; sizeBytes: number; duration?: number }) {
  const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
  return (
    <div className="inline-flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-lg glass-subtle border border-success/20 mb-3 max-w-full">
      <div className="w-6 h-6 rounded-md bg-success/15 border border-success/25 flex items-center justify-center shrink-0">
        <Check className="w-3.5 h-3.5 text-success" strokeWidth={2.5} />
      </div>
      <span className="text-xs text-text font-medium truncate max-w-[260px]">{filename}</span>
      <span className="text-[10px] text-text-dim font-mono shrink-0 border-l border-white/8 pl-2.5">
        {sizeMb} MB
        {duration ? ` · ${Math.round(duration)}s` : ''}
      </span>
    </div>
  );
}

// ─── Ready (terminal) card ──────────────────────────────────────────────

function ReadyCard({
  count, onEdit, onProcess,
}: {
  count: number; onEdit: () => void; onProcess: () => void;
}) {
  return (
    <div
      className="rounded-2xl glass-strong p-6 text-center space-y-4 animate-rise hairline-top relative overflow-hidden"
      style={{ animationDelay: '200ms' }}
    >
      {/* Subtle ambient glow behind the content */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(closest-side, rgba(74, 222, 128, 0.10), transparent 70%)',
        }}
      />
      <div className="mx-auto w-12 h-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
        <Check className="w-6 h-6 text-success" strokeWidth={2.5} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-text mb-1">All Set</h3>
        <p className="text-sm text-text-muted">
          <span className="text-text font-medium">{count} clips</span> loaded from your video. Edit them, customize styles, or start processing now.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 glass-subtle text-text text-sm font-medium hover:bg-white/8 hover:border-white/20"
        >
          <Film className="w-4 h-4" strokeWidth={1.75} />
          Edit Clips
        </button>
        <button
          onClick={onProcess}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-accent-hover shadow-soft"
        >
          <Play className="w-4 h-4" fill="currentColor" />
          Start Processing
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Right-column section card ──────────────────────────────────────────

function SectionCard({
  icon: Icon, label, delay, children,
}: {
  icon: React.ElementType; label: string; delay?: string; children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl glass p-4 animate-rise hairline-top"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-white/8 border border-white/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-text/85" strokeWidth={1.75} />
        </div>
        <span className="text-[10px] font-semibold text-text-dim uppercase tracking-[0.15em]">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── File upload button ─────────────────────────────────────────────────

function FileUploadButton({
  accept, fileType, label, onUploaded, variant = 'primary'
}: {
  accept: string; fileType: string; label: string;
  onUploaded: (file: File) => Promise<void>;
  variant?: 'primary' | 'ghost';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{ tried: number; used: number; quota: number } | null>(null);

  const { setFile } = useProjectStore();

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    setQuotaInfo(null);
    try {
      await setFile(fileType, file, (pct) => setProgress(pct));
      await onUploaded(file);
    } catch (err) {
      console.error('File import failed:', err);
      // Quota errors get a dedicated UI with usage stats + a hint to clean up.
      const opfs = await import('@/services/opfs');
      if (err instanceof opfs.OpfsQuotaError) {
        setQuotaInfo({ tried: err.tryingToWrite, used: err.used, quota: err.quota });
        setError('Browser storage is full.');
      } else {
        setError((err as Error)?.message || 'File import failed.');
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [fileType, onUploaded, setFile]);

  const fmt = (n: number) => n >= 1024 ** 3
    ? `${(n / 1024 ** 3).toFixed(2)} GB`
    : `${(n / 1024 ** 2).toFixed(0)} MB`;

  return (
    <div className="flex flex-col items-center gap-3">
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors",
          variant === 'primary' ? 'bg-white text-black hover:bg-accent-hover shadow-soft' : 'glass-subtle border border-white/10 text-text hover:bg-white/8 hover:border-white/20'
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {Math.round(progress)}%
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" strokeWidth={2} />
            {label}
          </>
        )}
      </button>

      {error && (
        <div className="w-full max-w-md rounded-xl glass-subtle border border-error/30 p-3 text-left">
          <p className="text-[13px] font-semibold text-error mb-1">{error}</p>
          {quotaInfo ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-text-muted leading-relaxed">
                Browsers cap each site's storage. You've used <span className="font-mono text-text">{fmt(quotaInfo.used)}</span>
                {quotaInfo.quota > 0 && <> of <span className="font-mono text-text">{fmt(quotaInfo.quota)}</span></>}
                ; this file needs <span className="font-mono text-text">{fmt(quotaInfo.tried)}</span> more.
              </p>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Free space by deleting old projects from the left sidebar (hover a project → trash icon), then try again.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-text-muted">Check the console for details and try again.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Whisper section (used inside Step 2) ───────────────────────────────

type TranscribeEngine = 'local' | 'assemblyai';

function SubtitlesSection({ onUploadSrt }: { onUploadSrt: (file: File) => Promise<void> }) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const updateCurrentProject = useProjectStore((s) => s.updateCurrentProject);
  const assemblyaiKey = useSettingsStore((s) => s.assemblyaiKey);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const [engine, setEngine] = useState<TranscribeEngine>(assemblyaiKey ? 'assemblyai' : 'local');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; detail?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasVideo = !!currentProject?.video_file?.path;
  const hasTranscript = !!currentProject?.whisper_words;

  const handleDownload = async () => {
    const proj = useProjectStore.getState().currentProject;
    if (!proj?.project_id) return;
    try {
      const { opfsReadFile } = await import('@/services/opfs');
      const srtId = `${proj.project_id}_srt_whisper`;
      const file = await opfsReadFile(srtId);
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = proj.srt_file?.filename || 'transcript.srt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error('Transcript download failed:', err);
      setError('Could not read the transcript file to download.');
    }
  };

  const handleGenerate = async () => {
    const proj = useProjectStore.getState().currentProject;
    if (!proj?.video_file?.path || !proj.video_file.duration) return;
    if (engine === 'assemblyai' && !assemblyaiKey) {
      openSettings();
      return;
    }
    setRunning(true);
    setError(null);
    setProgress({ pct: 0, detail: 'Starting' });
    try {
      const onProgress = (p: { pct: number; detail?: string }) => setProgress({ pct: p.pct, detail: p.detail });
      const args = { videoOpfsId: proj.video_file.path, durationSec: proj.video_file.duration, onProgress };

      let result: { srtText: string; words: Array<{ t0: number; t1: number; text: string }> };
      if (engine === 'assemblyai') {
        const { transcribeWithAssemblyAI } = await import('@/services/assemblyTranscribe');
        result = await transcribeWithAssemblyAI({ ...args, apiKey: assemblyaiKey });
      } else {
        const { transcribeVideo } = await import('@/services/whisperService');
        result = await transcribeVideo(args);
      }
      const { srtText, words } = result;
      if (!words.length) throw new Error('No speech detected in the video');

      const label = engine === 'assemblyai' ? 'AI Transcript (AssemblyAI).srt' : 'AI Transcript (Whisper).srt';
      const enc = new TextEncoder();
      const { opfsWriteBytes } = await import('@/services/opfs');
      const { dbRegisterFile } = await import('@/services/db');
      const srtId = `${proj.project_id}_srt_whisper`;
      const wordsId = `${proj.project_id}_words`;
      const srtBytes = enc.encode(srtText);
      const wordBytes = enc.encode(JSON.stringify(words));
      await opfsWriteBytes(srtId, srtBytes);
      await opfsWriteBytes(wordsId, wordBytes);
      await dbRegisterFile({ file_id: srtId, filename: label, file_type: 'srt', size_bytes: srtBytes.length, opfs_id: srtId, project_id: proj.project_id });
      await dbRegisterFile({ file_id: wordsId, filename: 'whisper-words.json', file_type: 'words', size_bytes: wordBytes.length, opfs_id: wordsId, project_id: proj.project_id });
      await updateCurrentProject({
        srt_file: { file_id: srtId, filename: label, file_type: 'srt', size_bytes: srtBytes.length, path: srtId },
        whisper_words: wordsId,
      });
      setProgress({ pct: 100, detail: 'Done' });
    } catch (err) {
      console.error('Transcription failed:', err);
      const { isChunkLoadError } = await import('@/lib/chunkReload');
      if (isChunkLoadError(err)) {
        setError('A newer version of OpenClip is live — reload to continue. (See the prompt at the bottom.)');
        window.dispatchEvent(new CustomEvent('app:chunk-reload-required'));
      } else {
        setError((err as Error)?.message || 'Transcription failed');
      }
    }
    setRunning(false);
  };

  const engineBtn = (id: TranscribeEngine, title: string, sub: string, icon: React.ReactNode) => (
    <button
      onClick={() => setEngine(id)}
      disabled={running}
      className={cn(
        'relative flex-1 p-5 rounded-2xl border text-left transition-all',
        engine === id
          ? 'bg-white/10 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
          : 'glass-subtle border-white/8 hover:bg-white/5 hover:border-white/15',
        running && 'opacity-50 pointer-events-none'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("transition-colors", engine === id ? "text-white" : "text-text-muted")}>{icon}</div>
        {engine === id && (
          <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center animate-rise">
             <Check className="w-3 h-3" strokeWidth={3} />
          </div>
        )}
      </div>
      <h4 className={cn("text-[15px] font-semibold mb-1 tracking-tight transition-colors", engine === id ? "text-text" : "text-text-muted")}>{title}</h4>
      <p className="text-xs text-text-dim leading-snug">{sub}</p>
    </button>
  );

  return (
    <div className="w-full mt-3 flex flex-col gap-5 animate-rise">
       {/* Engine selection */}
       <div className="flex flex-col sm:flex-row gap-3">
          {engineBtn('local', 'AI On-device', 'Private • Slower execution', <Cpu className="w-6 h-6" />)}
          {engineBtn('assemblyai', 'AssemblyAI', 'Fast • Cloud processing', <Cloud className="w-6 h-6" />)}
       </div>

       {/* Extra Info */}
       <div className="space-y-2">
          {engine === 'local' ? (
            <p className="text-[11px] text-text-dim leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-warning font-medium">Note:</span> Downloads an ~80&nbsp;MB model once. Transcription takes roughly the video&apos;s length on a typical PC. Runs entirely on your device.
            </p>
          ) : (
            <div className="text-[11px] text-text-dim leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
              <p className="mb-1">
                <span className="text-warning font-medium">Note:</span> Extremely fast, but audio is uploaded to AssemblyAI.
              </p>
              {assemblyaiKey ? (
                <p className="flex items-center gap-1.5 text-success font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" /> API key connected.
                </p>
              ) : (
                <button onClick={openSettings} className="text-text underline underline-offset-2 hover:opacity-80">
                  Add your AssemblyAI key in Settings → new users get $100 free credits.
                </button>
              )}
            </div>
          )}
          {error && <p className="text-[11px] text-error font-medium px-1">{error}</p>}
       </div>

       {/* Action buttons + Progress */}
       <div className="flex flex-col gap-3">
          {!running ? (
             <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
                <div className="flex flex-wrap items-center gap-2">
                   <button
                     onClick={handleGenerate}
                     disabled={!hasVideo || (engine === 'assemblyai' && !assemblyaiKey)}
                     className="px-5 py-2.5 rounded-lg bg-white text-black hover:bg-accent-hover text-sm font-semibold shadow-soft flex items-center gap-2 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/50 transition-colors"
                   >
                      {hasTranscript ? <RotateCcw className="w-4 h-4"/> : <Wand2 className="w-4 h-4"/>}
                      {hasTranscript ? 'Redo Transcript' : 'Generate AI'}
                   </button>
                   
                   {hasTranscript && (
                      <button onClick={handleDownload} className="px-4 py-2.5 rounded-lg glass-subtle border border-white/10 text-text hover:bg-white/10 hover:border-white/20 text-xs font-medium flex items-center gap-2 transition-colors">
                        <Download className="w-3.5 h-3.5"/> Download SRT
                      </button>
                   )}
                </div>

                <div className="flex items-center gap-3 pr-2">
                   <span className="text-xs text-text-dim">or</span>
                   <FileUploadButton
                     accept=".srt"
                     fileType="srt"
                     label="Upload SRT"
                     onUploaded={onUploadSrt}
                   />
                </div>
             </div>
          ) : (
             <div className="w-full bg-[#111] border border-white/10 rounded-2xl p-5 animate-rise shadow-soft">
                <div className="flex items-center justify-between mb-4 text-xs font-mono text-text-dim tracking-wider uppercase">
                   <span className="flex items-center gap-2.5">
                     <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)]" /> 
                     Generating Transcripts ...
                   </span>
                   <span className="text-white font-semibold text-sm">{progress?.pct ?? 0}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden border border-black/50">
                   <div className="h-full bg-[#b0a8f8] rounded-full transition-all duration-300 relative overflow-hidden" style={{ width: `${progress?.pct ?? 0}%` }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                   </div>
                </div>
                {progress?.detail && <p className="text-[11px] text-text-muted mt-4 italic flex justify-between">
                   <span>Status: {progress.detail}</span>
                   {progress.pct > 0 && progress.pct < 100 && <span>Processing audio...</span>}
                </p>}
             </div>
          )}
       </div>
    </div>
  );
}

function YouTubeInfoBadge() {
  return (
    <div className="flex items-center gap-2 text-xs text-text-dim pl-2">
      <Youtube className="w-3.5 h-3.5 text-text-muted shrink-0" />
      <span>YouTube? Use&nbsp;</span>
      <a
        href="https://github.com/yt-dlp/yt-dlp"
        target="_blank"
        rel="noopener noreferrer"
        className="text-text underline underline-offset-2 hover:opacity-80 flex items-center gap-0.5"
      >
        yt-dlp <ExternalLink className="w-2.5 h-2.5" />
      </a>
      <span>&nbsp;then import above</span>
    </div>
  );
}

function VideoSection({
  done, active, file, onUpload
}: {
  done: boolean; active: boolean; file?: { filename: string; size_bytes: number; duration?: number } | null; onUpload: (file: File) => Promise<void>;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl glass transition-all duration-300 animate-rise relative',
        done ? 'border border-success/25 p-5' : 'p-10 flex flex-col items-center text-center ring-1 ring-white/15 shadow-soft',
        !active && !done && 'opacity-50 pointer-events-none'
      )}
      style={{ animationDelay: '80ms' }}
    >
      <div className="absolute top-4 right-4 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/6 border border-white/8 text-text-dim tracking-wider">
        STEP 1
      </div>

      {done ? (
        <div className="flex items-start gap-4 pr-12">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border bg-success/12 text-success border-success/25">
            <Check className="w-5 h-5" strokeWidth={2.25} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-text mb-1 tracking-tight">Video Uploaded</h3>
            <p className="text-xs text-text-muted leading-relaxed mb-3">Your video is stored locally in your browser. No data is sent to any servers.</p>
            {file && <FileChip filename={file.filename} sizeBytes={file.size_bytes} duration={file.duration} />}
            <div className="flex flex-wrap items-center gap-3 mt-3">
               <FileUploadButton accept=".mp4,.mkv,.mov,.avi,.webm" fileType="video" label="Replace Video" onUploaded={onUpload} variant="ghost" />
               <YouTubeInfoBadge />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5 mt-2 transition-all hover:scale-105">
            <Upload className="w-6 h-6 text-text" />
          </div>
          <h3 className="text-xl font-semibold text-text mb-2 tracking-tight">Drag & Drop Video Files</h3>
          <p className="text-[13px] text-text-muted leading-relaxed mb-6 max-w-[320px]">
            Supported formats: MP4, MOV, ProRes, BRAW (Up to 8K resolution)
          </p>
          <FileUploadButton
            accept=".mp4,.mkv,.mov,.avi,.webm"
            fileType="video"
            label="Select Files"
            onUploaded={onUpload}
          />
          <div className="mt-4 opacity-75"><YouTubeInfoBadge /></div>
        </>
      )}
    </div>
  );
}

function SubtitleQuickControls() {
  const { styles, setSubtitleStyle } = useStyleStore();
  const sub = styles.subtitle;
  const isVertical = styles.export.format !== 'horizontal';

  const fontSize = sub.font_size ?? (isVertical ? 62 : 36);
  const marginV = sub.margin_v ?? (isVertical ? 120 : 60);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-text-muted">Text Size</label>
          <span className="text-xs text-text-dim font-mono">{fontSize}px</span>
        </div>
        <input
          type="range"
          min={20}
          max={90}
          value={fontSize}
          onChange={(e) => setSubtitleStyle({ font_size: Number(e.target.value) })}
          className="w-full accent-white"
        />
        <div className="flex justify-between text-[9px] text-text-dim mt-0.5">
          <span>Small</span>
          <span>Large</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-text-muted">Position (from bottom)</label>
          <span className="text-xs text-text-dim font-mono">{marginV}px</span>
        </div>
        <input
          type="range"
          min={20}
          max={400}
          value={marginV}
          onChange={(e) => setSubtitleStyle({ margin_v: Number(e.target.value) })}
          className="w-full accent-white"
        />
        <div className="flex justify-between text-[9px] text-text-dim mt-0.5">
          <span>Bottom edge</span>
          <span>Higher up</span>
        </div>
      </div>
    </div>
  );
}
