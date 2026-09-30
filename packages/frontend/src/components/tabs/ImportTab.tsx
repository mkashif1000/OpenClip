import { useEffect, useState } from 'react';
import {
  Film, FileText, Loader2, Check, ArrowRight, Play, Wand2,
  Download, RotateCcw, HardDrive, Eye, LayoutTemplate, Music,
  Cpu, Cloud, Sparkles, Image, SlidersHorizontal
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { LivePreview } from '@/components/styles/LivePreview';
import { MusicPanel } from '@/components/music/MusicPanel';
import { LogoPanel } from '@/components/logo/LogoPanel';
import { AiClipsGenerator } from '@/components/import/AiClipsGenerator';
import { ImportTemplateSelector } from '@/components/import/ImportTemplateSelector';
import {
  AdvancedVideoSection as VideoSection,
  ImportFileButton as FileUploadButton,
  ImportFileChip as FileChip,
} from '@/components/import/AdvancedImportSource';
import type { TemplateChoice } from '@/lib/templateSelection';
import { cn } from '@/lib/cn';
import type { MusicTrack, LogoConfig } from '@/types';
import '@/components/import/advanced-import.css';

type Step = 'video' | 'srt' | 'json' | 'ready';

export function ImportTab() {
  const { currentProject } = useProjectStore();
  const { clips, loadJsonClips } = useClipStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const workspaceMode = useUIStore((s) => s.workspaceMode);
  const [previewTrack, setPreviewTrack] = useState<MusicTrack | null>(null);
  const [logoConfig, setLogoConfig] = useState<LogoConfig | null>(currentProject?.logo_config || null);
  const [musicBlobUrl, setMusicBlobUrl] = useState<string | null>(null);
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null);
  const [clipNotice, setClipNotice] = useState<string | null>(null);
  const [templateSelection, setTemplateSelection] = useState<{ projectId: string; choice: TemplateChoice | null } | null>(null);
  const previewTemplate = templateSelection?.projectId === currentProject?.project_id ? templateSelection?.choice ?? null : null;

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
    <div className="advanced-import">
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="advanced-import-heading">
        <div>
          <p className="advanced-import-eyebrow"><SlidersHorizontal aria-hidden="true" /> Advanced workspace</p>
          <h2>Set up your clips</h2>
          <p className="advanced-import-intro">
            Start with a recording. Add subtitles, find your best moments, and make them yours.
          </p>
        </div>
        <div className="advanced-import-local">
          <HardDrive aria-hidden="true" />
          <span>Local-first workspace</span>
        </div>
      </div>

      {workspaceMode === 'quick' && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[.035] p-4 shadow-soft animate-rise">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-text-dim">Quick workflow</p>
              <p className="mt-1 text-sm font-semibold text-text">Import once, then let OpenClip guide the rest.</p>
              <p className="mt-1 text-xs text-text-muted">Upload your video, add subtitles, select clips, and export — advanced controls stay available in Studio mode.</p>
            </div>
            <button onClick={() => setActiveTab(hasClips ? 'process' : 'import')} className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black hover:bg-accent-hover">
              {hasClips ? 'Go to export' : 'Follow the steps'} <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <ProgressStrip
        steps={[
          { num: 1, label: 'Video', done: hasVideo, active: currentStep === 'video' },
          { num: 2, label: 'Subtitles', done: hasSrt, active: currentStep === 'srt' },
          { num: 3, label: 'Clips', done: hasClips, active: currentStep === 'json' },
          { num: 4, label: 'Process', done: false, active: currentStep === 'ready' },
        ]}
      />

      <div className="advanced-import-layout">
        {/* ─── Left column: source + step cards ───────────────────────── */}
        <div className="advanced-import-main">
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
            description="Import an SRT, or transcribe with on-device Whisper or AssemblyAI."
            icon={FileText}
            done={hasSrt}
            active={currentStep === 'srt'}
            file={currentProject?.srt_file}
          >
            {/* Same fix here — FileUploadButton inside SubtitlesSection handles setFile. */}
            <SubtitlesSection onUploadSrt={async () => { /* handled by FileUploadButton.setFile */ }} />
          </StepCard>

          {/* Step 3: AI clips (free, no key) — with JSON-file fallback */}
          <StepCard
            step={3}
            title="Find Clips with AI"
            description="Choose the moments worth sharing. Use a chatbot prompt or import clip JSON."
            icon={Sparkles}
            done={hasClips}
            active={currentStep === 'json'}
            file={currentProject?.json_file}
            extraInfo={hasClips ? `${clips.length} clips loaded` : undefined}
          >
            <div className="advanced-clips-flow">
              <p className="advanced-import-note">The prompt includes your transcript. Pasting it into a chatbot shares that text with the provider you choose.</p>
              <AiClipsGenerator />

              {/* Secondary: still allow a raw JSON file upload. */}
              <details className="advanced-json-import">
                <summary>
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
                <p role="alert" className="advanced-import-notice text-warning">{clipNotice}</p>
              )}
            </div>
          </StepCard>

          {/* Step 4: Ready */}
          {currentStep === 'ready' && (
            <ReadyCard count={clips.length} onEdit={() => setActiveTab('edit')} onProcess={() => setActiveTab('process')} />
          )}
        </div>

        {/* ─── Right column: live preview + template selector ────────── */}
        <aside className="advanced-import-sidebar" aria-label="Preview and finishing touches">
          {hasVideo ? (
            <>
              <SectionCard icon={Eye} label="Live Preview" className="advanced-preview-panel" showHeading={false}>
                <LivePreview
                  key={projectId}
                  template={previewTemplate}
                  musicSrc={musicBlobUrl ?? undefined}
                  musicVolume={previewTrack?.volume}
                  logoSrc={logoBlobUrl ?? undefined}
                  logoX={logoConfig?.x}
                  logoY={logoConfig?.y}
                  logoSize={logoConfig?.size}
                  logoOpacity={logoConfig?.opacity}
                />
              </SectionCard>
              <SectionCard icon={LayoutTemplate} label="Template Selector" className="advanced-template-panel">
                <ImportTemplateSelector
                  key={projectId}
                  choice={previewTemplate}
                  onSelect={(choice) => { if (projectId) setTemplateSelection({ projectId, choice }); }}
                />
              </SectionCard>
              <SectionCard icon={Music} label="Background Music" className="advanced-music-panel" showHeading={false}>
                <MusicPanel onTrackSelect={handleTrackSelect} />
              </SectionCard>
              <SectionCard icon={Image} label="Logo/Overlay" className="advanced-logo-panel" showHeading={false}>
                <LogoPanel onLogoChange={handleLogoChange} />
              </SectionCard>
            </>
          ) : (
            <>
              <SectionCard icon={Eye} label="Live Preview" className="advanced-preview-panel">
                <div className="advanced-preview-empty">
                  <div className="advanced-preview-frame" aria-hidden="true">
                    <span className="advanced-preview-frame-label">YOUR NEXT CLIP</span>
                    <Film />
                    <div className="advanced-preview-caption"><span>A great moment.</span><span>Made to share.</span></div>
                    <span className="advanced-preview-frame-line" />
                  </div>
                  <p>Your video, in focus</p>
                  <span>Import a recording to preview your framing, captions, and templates here.</span>
                </div>
              </SectionCard>
              <SectionCard icon={LayoutTemplate} label="Make it yours">
                <ul className="advanced-import-next">
                  <li><LayoutTemplate aria-hidden="true" /><div><h4>Start with a look</h4><p>Preview a template, then apply it to your loaded clips.</p></div></li>
                  <li><Music aria-hidden="true" /><div><h4>Add your soundtrack</h4><p>Bring in music and adjust it to fit your video.</p></div></li>
                  <li><Image aria-hidden="true" /><div><h4>Finish with your brand</h4><p>Place a logo or overlay before you export.</p></div></li>
                </ul>
              </SectionCard>
            </>
          )}
          <div className="advanced-import-privacy">
            <HardDrive aria-hidden="true" />
            <p><strong>Local files. Your choice of AI.</strong> Imported files stay in this browser. On-device Whisper processes audio locally. Optional AssemblyAI sends audio to its service; chatbot prompts share the transcript when you paste them.</p>
          </div>
        </aside>
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
  return (
    <ol className="advanced-import-progress" aria-label="Import workflow">
      {steps.map((s) => (
        <li key={s.num} data-state={s.done ? 'done' : s.active ? 'active' : 'pending'} aria-current={s.active ? 'step' : undefined}>
          <span className="advanced-progress-number" aria-hidden="true">
            {s.done ? <Check strokeWidth={2} /> : String(s.num).padStart(2, '0')}
          </span>
          <div className="advanced-progress-copy">
            <span>{s.label}</span>
            <span>{s.done ? 'Complete' : s.active ? (s.num === 4 ? 'Ready to export' : 'Up next') : 'Pending'}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ─── Step card ──────────────────────────────────────────────────────────

function StepCard({
  step, title, description, icon: Icon, done, active, file, extraInfo, children,
}: {
  step: number; title: string; description: string; icon: React.ElementType;
  done: boolean; active: boolean;
  file?: { filename: string; size_bytes: number; duration?: number } | null;
  extraInfo?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="advanced-step-card"
      data-state={done ? 'done' : active ? 'active' : 'pending'}
      aria-labelledby={`advanced-step-${step}`}
    >
      <div className="advanced-step-header">
        <span className="advanced-step-icon" aria-hidden="true">
          {done ? <Check strokeWidth={2} /> : <Icon strokeWidth={1.75} />}
        </span>
        <div className="advanced-step-copy">
          <p className="advanced-step-kicker">Step {String(step).padStart(2, '0')}</p>
          <h3 id={`advanced-step-${step}`}>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="advanced-step-state">{done ? 'Complete' : active ? 'Up next' : 'Pending'}</span>
      </div>

      {done && (file || extraInfo) && (
        <div className="advanced-step-result">
          {file && <FileChip filename={file.filename} sizeBytes={file.size_bytes} duration={file.duration} />}
          {extraInfo && <span className="advanced-clips-count"><Check aria-hidden="true" />{extraInfo}</span>}
        </div>
      )}
      {(active || done) ? <div className="advanced-step-body">{children}</div> : (
        <p className="advanced-step-waiting">{step === 2 ? 'Available after you import a video.' : 'Available after you add subtitles.'}</p>
      )}
    </section>
  );
}

// ─── Ready (terminal) card ──────────────────────────────────────────────

function ReadyCard({
  count, onEdit, onProcess,
}: {
  count: number; onEdit: () => void; onProcess: () => void;
}) {
  return (
    <section className="advanced-ready-card" aria-labelledby="advanced-ready-title">
      <div className="advanced-ready-copy">
        <span className="advanced-ready-icon"><Check aria-hidden="true" strokeWidth={2} /></span>
        <div>
          <p className="advanced-import-eyebrow">Ready for the next step</p>
          <h3 id="advanced-ready-title">All set. Make them yours.</h3>
          <p><strong>{count} {count === 1 ? 'clip' : 'clips'}</strong> loaded. Fine-tune your edits or start processing.</p>
        </div>
      </div>
      <div className="advanced-ready-actions">
        <button
          type="button"
          onClick={onEdit}
          className="advanced-import-button advanced-import-button--secondary"
        >
          <Film className="w-4 h-4" strokeWidth={1.75} />
          Edit Clips
        </button>
        <button
          type="button"
          onClick={onProcess}
          className="advanced-import-button advanced-import-button--primary"
        >
          <Play className="w-4 h-4" fill="currentColor" />
          Start Processing
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

// ─── Right-column section card ──────────────────────────────────────────

function SectionCard({
  icon: Icon, label, className, showHeading = true, children,
}: {
  icon: React.ElementType; label: string; className?: string; showHeading?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={cn('advanced-side-panel', className)}>
      {showHeading && (
        <div className="advanced-side-heading">
          <Icon aria-hidden="true" strokeWidth={1.75} />
          <h3>{label}</h3>
        </div>
      )}
      <div className="advanced-panel-body">{children}</div>
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
  const [language, setLanguage] = useState('auto');
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
      const args = { videoOpfsId: proj.video_file.path, durationSec: proj.video_file.duration, onProgress, language };

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
      type="button"
      onClick={() => setEngine(id)}
      disabled={running}
      aria-pressed={engine === id}
      className="advanced-transcribe-choice"
    >
      <span className="advanced-transcribe-icon" aria-hidden="true">{icon}</span>
      <span className="advanced-transcribe-label"><strong>{title}</strong><span>{sub}</span></span>
      <span className="advanced-transcribe-check" aria-hidden="true">{engine === id && <Check strokeWidth={2.5} />}</span>
    </button>
  );

  return (
    <div className="advanced-subtitles">
      <fieldset className="advanced-transcribe-providers">
        <legend>Transcription provider</legend>
        <div className="advanced-transcribe-options">
          {engineBtn('local', 'AI On-device', 'Whisper · Local processing', <Cpu />)}
          {engineBtn('assemblyai', 'AssemblyAI', 'Cloud processing · API key', <Cloud />)}
        </div>
      </fieldset>

      {engine === 'local' && (
        <label className="advanced-transcribe-language">
          <span><strong>Transcript language</strong><span>Choose a language or let Whisper detect it.</span></span>
          <select aria-label="Transcript language" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={running}>
            <option value="auto">Auto detect</option><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="pt">Portuguese</option><option value="hi">Hindi</option><option value="ar">Arabic</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="zh">Chinese</option>
          </select>
        </label>
      )}

      <div className="advanced-transcribe-info">
        {engine === 'local' ? (
          <p>Downloads a speech model once. Audio is processed on your device; speed depends on your recording and hardware.</p>
        ) : (
          <>
            <p>Audio is sent to AssemblyAI for transcription. Usage is billed through your AssemblyAI account.</p>
            {assemblyaiKey ? (
              <p className="advanced-transcribe-connected"><Check aria-hidden="true" /> API key connected</p>
            ) : (
              <button type="button" onClick={openSettings} className="advanced-import-text-button">Add your AssemblyAI key in Settings <ArrowRight aria-hidden="true" /></button>
            )}
          </>
        )}
      </div>
      {error && <p role="alert" className="advanced-import-notice text-error">{error}</p>}

      {!running ? (
        <div className="advanced-transcribe-actions">
          <div className="advanced-transcribe-generate">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!hasVideo || (engine === 'assemblyai' && !assemblyaiKey)}
              className="advanced-import-button advanced-import-button--primary"
            >
              {hasTranscript ? <RotateCcw aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
              {hasTranscript ? 'Redo Transcript' : 'Generate AI'}
            </button>
            {hasTranscript && (
              <button type="button" onClick={handleDownload} className="advanced-import-button advanced-import-button--secondary">
                <Download aria-hidden="true" /> Download SRT
              </button>
            )}
          </div>
          <div className="advanced-transcribe-upload">
            <span>or</span>
            <FileUploadButton accept=".srt" fileType="srt" label="Upload SRT" variant="ghost" onUploaded={onUploadSrt} />
          </div>
        </div>
      ) : (
        <div className="advanced-transcribe-progress" aria-busy="true">
          <div className="advanced-transcribe-progress-heading">
            <span><Loader2 aria-hidden="true" className="animate-spin" /> Generating transcript</span>
            <strong>{Math.round(progress?.pct ?? 0)}%</strong>
          </div>
          <div className="advanced-transcribe-track" role="progressbar" aria-label="Transcription progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.pct ?? 0}>
            <div style={{ width: `${Math.max(0, Math.min(100, progress?.pct ?? 0))}%` }} />
          </div>
          <p role="status">{progress?.detail || 'Preparing audio…'}</p>
        </div>
      )}
    </div>
  );
}
