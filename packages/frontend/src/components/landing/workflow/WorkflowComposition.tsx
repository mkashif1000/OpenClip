import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { ArrowUpRight } from 'lucide-react';
import { WORKFLOW_STEPS, WORKFLOW_STEP_FRAMES, workflowStepAtFrame } from './workflowData';
import { SceneArtwork, STORY, motionProgress } from './workflowScenes';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function Chapter({ index, frame, compact, reducedMotion }: { index: number; frame: number; compact: boolean; reducedMotion: boolean }) {
  const story = STORY[index];
  const enter = reducedMotion ? 1 : motionProgress(frame, 0, 18);
  const detail = reducedMotion ? 1 : motionProgress(frame, 10, 24);
  return (
    <AbsoluteFill className="workflow-film-chapter" style={{ background: '#090909' }}>
      <div style={{ position: 'absolute', width: compact ? 680 : 770, height: 770, right: compact ? -140 : -80, top: compact ? 240 : -70, borderRadius: '50%', background: 'radial-gradient(circle, #ffffff0a, transparent 68%)', transform: `translateY(${reducedMotion ? 0 : Math.sin(frame / 75) * 6}px)` }} />
      <div style={{ position: 'absolute', left: compact ? 42 : 58, right: compact ? 42 : 58, top: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 23, fontWeight: 750, letterSpacing: -1 }}><span style={{ width: 28, height: 28, border: '7px solid #f5f5f5', borderRightWidth: 2, borderRadius: 8, transform: 'rotate(-12deg)' }} />openclip</div>
        <span style={{ fontFamily: 'monospace', fontSize: compact ? 19 : 15, color: '#777', letterSpacing: 1 }}>THE CREATIVE PROCESS</span>
      </div>
      <div style={{ position: 'absolute', left: compact ? 42 : 58, top: compact ? 112 : 173, width: compact ? 636 : 424 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: compact ? 20 : 15, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: '#aaa', marginBottom: compact ? 18 : 24 }}><span style={{ fontFamily: 'monospace', color: '#fff' }}>{String(index + 1).padStart(2, '0')}</span><span style={{ width: 26, height: 1, background: '#666' }} />{WORKFLOW_STEPS[index].shortTitle}</div>
        <h3 className="workflow-film-title" style={{ margin: 0, whiteSpace: 'pre-line', fontSize: compact ? 65 : 72, lineHeight: 1.01, letterSpacing: -4, fontWeight: 650, transform: `translateY(${(1 - enter) * 22}px)`, opacity: .3 + enter * .7 }}>{story.title}</h3>
        {!compact && <p style={{ margin: '26px 0 0', color: '#949494', fontSize: 22, lineHeight: 1.55, maxWidth: 340, opacity: detail, transform: `translateY(${(1 - detail) * 12}px)` }}>{story.description}</p>}
      </div>
      <div className="workflow-film-art" style={{ position: 'absolute', left: compact ? 42 : 510, top: compact ? 350 : 144, width: compact ? 636 : 632, height: 470 }}>
        <SceneArtwork index={index} frame={frame} reducedMotion={reducedMotion} />
      </div>
      <div style={{ position: 'absolute', left: compact ? 42 : 58, right: compact ? 42 : 58, bottom: compact ? 72 : 70, display: 'flex', alignItems: 'center', gap: 12, color: '#b4b4b4', fontSize: compact ? 23 : 17, lineHeight: 1.4 }}><ArrowUpRight size={compact ? 25 : 20} strokeWidth={1.5} style={{ flexShrink: 0 }} />{story.takeaway}</div>
    </AbsoluteFill>
  );
}

/** Frame-driven vector scenes: scrubbing, playback and reduced motion share one timeline. */
export function WorkflowComposition({ compact, reducedMotion = false }: { compact: boolean; reducedMotion?: boolean }) {
  const frame = useCurrentFrame();
  const index = workflowStepAtFrame(frame);
  const local = frame - index * WORKFLOW_STEP_FRAMES;
  const transition = reducedMotion || index === 0 ? 1 : interpolate(local, [0, 12], [0, 1], { ...clamp, easing: Easing.bezier(.2, 0, 0, 1) });
  return (
    <AbsoluteFill data-scene={WORKFLOW_STEPS[index].id} style={{ background: '#090909', color: '#f5f5f5', fontFamily: 'Inter, "Segoe UI", sans-serif', overflow: 'hidden', pointerEvents: 'none', userSelect: 'none' }}>
      {transition < 1 && <AbsoluteFill aria-hidden="true"><Chapter index={index - 1} frame={179} compact={compact} reducedMotion /></AbsoluteFill>}
      <AbsoluteFill className="workflow-film-active" style={{ opacity: transition, transform: `translateY(${(1 - transition) * 18}px)` }}><Chapter index={index} frame={local} compact={compact} reducedMotion={reducedMotion} /></AbsoluteFill>
      <div style={{ position: 'absolute', bottom: 34, left: compact ? 42 : 58, right: compact ? 42 : 58, display: 'flex', gap: 9 }}>
        {WORKFLOW_STEPS.map((step, chapter) => <div key={step.id} style={{ height: 2, flex: 1, background: '#2c2c2c', overflow: 'hidden' }}><div style={{ height: '100%', background: '#e5e5e5', transformOrigin: 'left', transform: `scaleX(${interpolate(frame, [chapter * WORKFLOW_STEP_FRAMES, (chapter + 1) * WORKFLOW_STEP_FRAMES - 1], [0, 1], clamp)})` }} /></div>)}
      </div>
    </AbsoluteFill>
  );
}
