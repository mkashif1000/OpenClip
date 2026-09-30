import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Captions, Check, ClipboardPaste, Download, Film, LayoutTemplate, Music2, Play, SlidersHorizontal, Upload } from 'lucide-react';
import { WORKFLOW_CHAPTER_PREVIEW_FRAME, WORKFLOW_DURATION, WORKFLOW_STEP_FRAMES, WORKFLOW_STEPS, workflowTime } from './workflowData';
import './workflow.css';

const WorkflowVideo = lazy(() => import('./WorkflowVideo'));
const icons = [Upload, Captions, SlidersHorizontal, ClipboardPaste, Music2, LayoutTemplate, Download];

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="workflow-loading" role="status"><Film size={32} /><p>The video could not load.</p><span>You can still follow every step below.</span></div>;
    return this.props.children;
  }
}

export function WorkflowSection({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{ frame: number; version: number } | null>(null);
  const active = WORKFLOW_STEPS[activeStep];

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '300px' });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const selectStep = (index: number) => {
    setReady(true);
    setActiveStep(index);
    setSeekRequest((previous) => ({ frame: index * WORKFLOW_STEP_FRAMES + WORKFLOW_CHAPTER_PREVIEW_FRAME, version: (previous?.version ?? 0) + 1 }));
  };

  const loading = <div className="workflow-loading" role="status"><Film size={32} /><p>Your workflow, in motion.</p><span>Loading the {workflowTime(WORKFLOW_DURATION)} walkthrough…</span></div>;

  return (
    <section ref={sectionRef} id="workflow" aria-labelledby="workflow-heading" className="workflow-section">
      <div className="workflow-container">
        <div className="workflow-heading-row">
          <div className="workflow-heading-copy">
            <p className="workflow-eyebrow"><span /> A simple workflow</p>
            <h2 id="workflow-heading">One recording.<br /><span>A whole new set of clips.</span></h2>
            <p className="workflow-intro">From your first import to the final download. See how OpenClip turns your ideas into publish-ready videos, one step at a time.</p>
          </div>
          <div className="workflow-tour-badge"><span><Play size={14} fill="currentColor" /> {workflowTime(WORKFLOW_DURATION)} guided tour</span><p>7 steps. You stay in control.</p></div>
        </div>

        <div className="workflow-layout">
          <div className="workflow-watch-column">
            <div className="workflow-player-shell">
              <div className="workflow-player-topbar"><span>OpenClip / the creative process</span><span className="workflow-demo-label">Animated product tour</span></div>
              <PreviewBoundary>
                {ready ? <Suspense fallback={loading}><WorkflowVideo seekRequest={seekRequest} onStepChange={setActiveStep} /></Suspense> : loading}
              </PreviewBoundary>
            </div>
            <div className="workflow-current" id="workflow-current" aria-atomic="true">
              <span className="workflow-current-number" aria-hidden="true">{String(activeStep + 1).padStart(2, '0')}</span>
              <div><h3>{active.title}</h3><p>{active.description}</p><p className="workflow-detail">{active.detail}</p></div>
            </div>
          </div>

          <nav className="workflow-chapters" aria-label="Walkthrough chapters">
            <div className="workflow-chapters-heading"><span>The creative process</span><span>Jump to a step <ArrowRight size={13} /></span></div>
            <ol className="workflow-chapter-list">
              {WORKFLOW_STEPS.map((step, index) => {
                const Icon = icons[index];
                const selected = index === activeStep;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      className="workflow-chapter"
                      aria-label={`Step ${index + 1}: ${step.title}`}
                      aria-current={selected ? 'step' : undefined}
                      aria-controls="workflow-current"
                      onClick={() => selectStep(index)}
                    >
                      <span className="workflow-chapter-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="workflow-chapter-copy"><span>{step.title}</span><span><Icon size={12} aria-hidden="true" />{step.shortTitle} <span aria-hidden="true">·</span> {workflowTime(index * WORKFLOW_STEP_FRAMES)}</span></span>
                      {selected && <span className="workflow-chapter-indicator" aria-hidden="true"><Play size={11} fill="currentColor" /></span>}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="workflow-chapter-note">Press play to watch, or choose any step to explore at your own pace. No sound needed.</p>
          </nav>
        </div>

        <div className="workflow-bottom-row">
          <p><Check size={16} /> Your ideas. Your AI. Your creative control.</p>
          <button type="button" onClick={onOpenWorkspace}>Try it with your video <ArrowRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}
