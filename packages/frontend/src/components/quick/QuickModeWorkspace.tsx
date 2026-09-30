import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Settings, Film, Captions, Scissors, Palette, Download } from 'lucide-react';
import { useClipStore } from '@/stores/clipStore';
import { useProjectStore } from '@/stores/projectStore';
import { useStyleStore } from '@/stores/styleStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { PODCAST_TEMPLATES } from '@/data/premadeTemplates';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { WorkspaceModeSwitch } from '@/components/layout/WorkspaceModeSwitch';
import { QuickTranscriptStep } from './QuickTranscriptStep';
import { QuickClipsStep } from './QuickClipsStep';
import { QuickStyleStep } from './QuickStyleStep';
import { QuickVideoStep } from './QuickVideoStep';
import { QuickExportPanel } from './QuickExportPanel';
import { mergeQuickStyle, resolveQuickStyle, styleQuickClip } from './quickStyle';
import { useClipTemplateStore } from '@/stores/clipTemplateStore';
import { useProcessingStore } from '@/stores/processingStore';
import { cn } from '@/lib/cn';
import { dbGetTemplates, dbGetProject } from '@/services/db';
import type { Template } from '@/types';
import './quick-mode.css';

type QuickStep = 'video' | 'transcript' | 'clips' | 'style' | 'export';

const STEP_ORDER: QuickStep[] = ['video', 'transcript', 'clips', 'style', 'export'];
const STEP_ICONS = { video: Film, transcript: Captions, clips: Scissors, style: Palette, export: Download };

const STEP_META: Record<QuickStep, { label: string; eyebrow: string; title: string; description: string }> = {
  video: {
    label: 'Import',
    eyebrow: 'Step 1 of 5',
    title: 'Start with your video.',
    description: 'Choose a long-form recording. It stays on this device while OpenClip prepares your workspace.',
  },
  transcript: {
    label: 'Transcript',
    eyebrow: 'Step 2 of 5',
    title: 'Add your transcript once.',
    description: 'Upload an existing SRT transcript or generate one privately in your browser.',
  },
  clips: {
    label: 'Find clips',
    eyebrow: 'Step 3 of 5',
    title: 'Find the moments worth sharing.',
    description: 'OpenClip will turn your transcript into a focused set of short clips you can export together.',
  },
  style: {
    label: 'Style',
    eyebrow: 'Step 4 of 5',
    title: 'Make every clip feel consistent.',
    description: 'Preview a premade or saved template, add background audio, and place your logo before exporting.',
  },
  export: {
    label: 'Export',
    eyebrow: 'Step 5 of 5',
    title: 'Render and save your clips.',
    description: 'Review the queue, keep the recommended output settings, and render locally when you are ready.',
  },
};

export function QuickModeWorkspace() {
  const project = useProjectStore((s) => s.currentProject);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const updateCurrentProject = useProjectStore((s) => s.updateCurrentProject);
  const setStyles = useStyleStore((s) => s.setStyles);
  const currentStyles = useStyleStore((s) => s.styles);
  const clips = useClipStore((s) => s.clips);
  const setClips = useClipStore((s) => s.setClips);
  const updateClip = useClipStore((s) => s.updateClip);
  const setWorkspaceMode = useUIStore((s) => s.setWorkspaceMode);
  const setLandingPage = useUIStore((s) => s.setLandingPage);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const isProcessing = useProcessingStore((s) => s.isProcessing);

  const [step, setStep] = useState<QuickStep>('video');
  const [selectedStyle, setSelectedStyle] = useState('pod_title_captions');
  const [styleApplied, setStyleApplied] = useState(false);
  const [applyingStyle, setApplyingStyle] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [stylesReady, setStylesReady] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const locked = applyingStyle || mediaBusy || isProcessing;
  const applyingRef = useRef(false);
  const projectId = project?.project_id;

  const selectedStyleChoice = useMemo(() => resolveQuickStyle(selectedStyle, savedTemplates), [savedTemplates, selectedStyle]);

  const hasVideo = !!project?.video_file;
  const hasCaptions = !!project?.srt_file;
  const hasClips = clips.length > 0;
  const stepIndex = STEP_ORDER.indexOf(step);
  const meta = STEP_META[step];
  const StepIcon = STEP_ICONS[step];

  // The sidebar is not rendered in Quick Mode. Hydrate the clip/style stores
  // here so entering Quick Mode from an existing project never shows stale or
  // empty data from the previously selected project.
  useEffect(() => {
    void loadProjects().catch(() => setStyleError('Could not load projects. Please reload and try again.'));
  }, [loadProjects]);

  useEffect(() => {
    if (step !== 'style') return;
    let cancelled = false;
    void dbGetTemplates().then((items) => { if (!cancelled) setSavedTemplates(items); })
      .catch(() => { if (!cancelled) setStyleError('Could not load saved templates. Return to this step to retry.'); });
    return () => { cancelled = true; };
  }, [step]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setStylesReady(false);
    setStyleError(null);
    setStyleApplied(false);
    void dbGetProject(projectId).then((saved) => {
      if (cancelled || !saved || useProjectStore.getState().currentProjectId !== projectId) return;
      // Read-only hydration: project.clips can be stale after editing. Never
      // write that stale array back over the persisted clips on mode switching.
      useClipStore.setState({ clips: saved.clips, selectedClipId: null });
      useStyleStore.setState({ styles: saved.styles });
      setStep(!saved.video_file ? 'video' : !saved.srt_file ? 'transcript' : 'clips');
      setStylesReady(true);
    }).catch(() => { if (!cancelled) setStyleError('Could not restore this project. Please reload before continuing.'); });
    return () => { cancelled = true; };
  }, [projectId]);

  const canVisit = (candidate: QuickStep) => {
    if (locked) return false;
    const candidateIndex = STEP_ORDER.indexOf(candidate);
    if (candidateIndex === 0) return true;
    if (candidateIndex >= 1 && !hasVideo) return false;
    if (candidateIndex >= 2 && !hasCaptions) return false;
    if (candidateIndex >= 3 && !hasClips) return false;
    if (candidateIndex >= 4 && !styleApplied) return false;
    return true;
  };

  const handleVideoUploaded = async () => {
    // A replacement video invalidates all derived assets. Do this only after
    // the new file has been stored successfully so a failed upload preserves
    // the previous project.
    const currentProject = useProjectStore.getState().currentProject;
    if (!currentProject) return;
    await updateCurrentProject({ srt_file: null, json_file: null, whisper_words: null });
    setClips([]);
    setStyleApplied(false);
    setStep('transcript');
  };

  const handleCaptionsChanged = async ({ preserveWordTimings }: { preserveWordTimings: boolean }) => {
    await updateCurrentProject({
      json_file: null,
      ...(preserveWordTimings ? {} : { whisper_words: null }),
    });
    setClips([]);
    setStyleApplied(false);
    setStep('clips');
  };

  const handleClipsDetected = useCallback(() => setStyleApplied(false), []);

  const applyStyle = async () => {
    if (!selectedStyleChoice || !clips.length || applyingRef.current || !stylesReady || isProcessing) return;

    applyingRef.current = true;
    setApplyingStyle(true);
    setStyleError(null);
    try {
      await Promise.all(clips.map((clip) => updateClip(clip.clip_id, { edits: styleQuickClip(clip, selectedStyleChoice).edits })));
      // Per-clip assignments would otherwise override the new project style.
      for (const clip of clips) useClipTemplateStore.getState().setClipTemplate(clip.clip_id, null);
      setStyles(mergeQuickStyle(selectedStyleChoice, currentStyles));
      await useStyleStore.getState().saveStyles();

      setStyleApplied(true);
      setStep('export');
    } catch (error) {
      console.error('Quick Mode style apply failed:', error);
      setStyleError('Could not save the complete style change. Please retry before exporting.');
    } finally {
      setApplyingStyle(false);
      applyingRef.current = false;
    }
  };

  const nextStep = () => {
    if (step === 'video' && hasVideo) setStep('transcript');
    else if (step === 'transcript' && hasCaptions) setStep('clips');
    else if (step === 'clips' && hasClips) setStep('style');
    else if (step === 'style') void applyStyle();
  };

  const nextLabel = step === 'video'
    ? 'Continue to transcript'
    : step === 'transcript'
      ? 'Find clips'
      : step === 'clips'
        ? 'Open style'
        : 'Apply style & continue';

  return (
    <div className="quick-workspace min-h-screen text-text selection:bg-[#f5f5f5]/20" data-quick-step={step}>
      <header className="sticky top-0 z-30 px-3 pt-3 pb-2 sm:px-6 sm:pt-4">
        <fieldset disabled={locked} className="mx-auto grid min-h-[68px] w-full min-w-0 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-white/5 bg-[#121212]/90 px-3 py-3 shadow-lg backdrop-blur-xl sm:px-4 xl:h-[68px] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:py-0">
          <button type="button" onClick={() => setLandingPage(true)} className="justify-self-start shrink-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#121212]" aria-label="OpenClip home" title="Return to Landing Page">
            <BrandLogo />
          </button>

          <nav className="order-last col-span-2 flex min-w-0 w-full items-center justify-center gap-0.5 rounded-2xl border border-white/[.07] bg-black/25 p-1 sm:gap-1 xl:order-none xl:col-span-1 xl:w-auto" aria-label="Quick Mode progress">
            {STEP_ORDER.map((item, index) => {
              const done = index < stepIndex || (item === 'video' && hasVideo) || (item === 'transcript' && hasCaptions) || (item === 'clips' && hasClips) || (item === 'style' && styleApplied);
              const active = item === step;
              const enabled = canVisit(item);
              return (
                <button
                  key={item}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setStep(item)}
                  className={cn(
                    'flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-1 py-2 text-[9px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:flex-none sm:px-3 sm:text-[11px]',
                    active ? 'bg-white text-black shadow-soft' : done ? 'text-white hover:bg-white/[.07]' : 'text-text-dim',
                    !enabled && 'cursor-not-allowed opacity-45',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className={cn('hidden h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] sm:flex', active ? 'border-black/10 bg-black/10' : done ? 'border-success/40 bg-success/10 text-success' : 'border-white/15')}>
                    {done && !active ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  {STEP_META[item].label}
                </button>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center justify-self-end gap-1.5 sm:gap-2">
            {projects.length > 0 && (
              <label className="hidden min-w-0 max-w-[160px] items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.035] px-3 py-2 sm:flex xl:max-w-[128px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <select
                  value={project?.project_id ?? ''}
                  onChange={(event) => { if (event.target.value) void selectProject(event.target.value); }}
                  className="min-w-0 max-w-[120px] truncate bg-transparent text-[11px] font-medium text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label="Active project"
                >
                  {projects.map((item) => <option key={item.project_id} value={item.project_id}>{item.name}</option>)}
                </select>
              </label>
            )}
            <WorkspaceModeSwitch />
            <button onClick={openSettings} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[.07] bg-black/20 text-text-muted hover:bg-white/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label="Open settings" title="Settings">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </fieldset>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pb-8 pt-7 sm:px-6 lg:pt-10">
        <div className="min-w-0">
          <div className="quick-step-heading mb-7 grid items-end gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-2.5"><span className="quick-icon"><StepIcon className="h-5 w-5" aria-hidden="true" /></span><div><p className="quick-kicker">Quick workspace</p><p className="mt-1 text-xs text-text-muted">{meta.eyebrow} <span className="mx-1.5 text-white/20">/</span> {meta.label}</p></div></div>
              <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-.035em] text-white sm:text-4xl">{meta.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted">{meta.description}</p>
            </div>
            <div className="quick-panel-soft hidden p-4 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-text-dim">{project ? 'Current project' : 'A focused workflow'}</p>
              <p className={cn('mt-2 text-sm font-medium leading-5 text-white', project && 'truncate')} title={project?.name}>{project?.name ?? 'One video. More possibilities.'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text-muted"><span className="h-1.5 w-1.5 rounded-full bg-[#f5f5f5]" />{hasClips ? `${clips.length} clips in your batch` : hasCaptions ? 'Transcript ready' : hasVideo ? 'Source video ready' : 'Import → style → export'}</div>
            </div>
          </div>

          <div className="quick-progress mb-7 grid grid-cols-5 gap-1.5" role="progressbar" aria-label="Workflow step" aria-valuemin={1} aria-valuemax={STEP_ORDER.length} aria-valuenow={stepIndex + 1} aria-valuetext={meta.eyebrow}>
            {STEP_ORDER.map((item, index) => <span key={item} className="h-1 rounded-full" data-state={index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'upcoming'} />)}
          </div>

          <div key={step} className="quick-step-content">
            {step === 'video' && <QuickVideoStep project={project} onUploaded={handleVideoUploaded} onBusyChange={setMediaBusy} />}
            {step === 'transcript' && <QuickTranscriptStep project={project} onCaptionsChanged={handleCaptionsChanged} onBusyChange={setMediaBusy} />}
            {step === 'clips' && <QuickClipsStep key={projectId} project={project} clips={clips} onClipsDetected={handleClipsDetected} onContinue={() => setStep('style')} onBusyChange={setMediaBusy} />}
            {step === 'style' && (
              <QuickStyleStep
                key={projectId}
                project={project}
                templates={PODCAST_TEMPLATES}
                savedTemplates={savedTemplates}
                selectedStyle={selectedStyle}
                choice={selectedStyleChoice}
                onBusyChange={setMediaBusy}
                onSelect={(id) => { setSelectedStyle(id); setStyleApplied(false); setStyleError(null); }}
                applying={applyingStyle || !stylesReady}
                error={styleError}
              />
            )}
            {step === 'export' && <QuickExportPanel onOpenAdvanced={() => setWorkspaceMode('advanced')} />}
          </div>

          {styleError && step !== 'style' && <p role="alert" className="mt-4 text-xs text-error">{styleError}</p>}
          <fieldset disabled={locked} className="quick-step-footer mt-6 flex min-w-0 flex-col-reverse gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex items-center gap-3">
              {step !== 'video' && (
                <button type="button" onClick={() => setStep(STEP_ORDER[Math.max(0, stepIndex - 1)])} className="quick-button-secondary px-3.5 py-2.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
              )}
              <button type="button" onClick={() => setWorkspaceMode('advanced')} className="hidden text-xs font-medium text-text-dim hover:text-white sm:inline">
                Need more control? Open Advanced mode
              </button>
            </div>

            {step !== 'export' && (
              <button
                type="button"
                onClick={nextStep}
                disabled={(step === 'video' && !hasVideo) || (step === 'transcript' && !hasCaptions) || (step === 'clips' && !hasClips) || (step === 'style' && (!stylesReady || !selectedStyleChoice)) || locked}
                className="quick-button-primary px-5 py-3 text-sm"
              >
                {applyingStyle && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {applyingStyle ? 'Applying style…' : nextLabel}
                {!applyingStyle && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            )}
          </fieldset>
        </div>
      </main>

      <SettingsModal />
    </div>
  );
}
