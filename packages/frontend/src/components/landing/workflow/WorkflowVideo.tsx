import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { WorkflowComposition } from './WorkflowComposition';
import { WORKFLOW_DURATION, WORKFLOW_FPS, WORKFLOW_STEP_FRAMES, workflowStepAtFrame, workflowTime } from './workflowData';

export interface WorkflowVideoProps {
  seekRequest: { frame: number; version: number } | null;
  onStepChange: (index: number) => void;
}

export default function WorkflowVideo({ seekRequest, onStepChange }: WorkflowVideoProps) {
  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chapterPreviewRef = useRef(false);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(15);
  const [failed, setFailed] = useState(false);
  const inputProps = useMemo(() => ({ compact, reducedMotion }), [compact, reducedMotion]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const update = ({ detail }: { detail: { frame: number } }) => {
      setFrame(detail.frame);
      onStepChange(workflowStepAtFrame(detail.frame));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setFrame(player.getCurrentFrame()); };
    const onEnd = () => { setPlaying(false); setFrame(WORKFLOW_DURATION - 1); };
    const onError = () => { player.pause(); setFailed(true); };
    player.addEventListener('timeupdate', update);
    player.addEventListener('seeked', update);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnd);
    player.addEventListener('error', onError);
    return () => {
      player.removeEventListener('timeupdate', update);
      player.removeEventListener('seeked', update);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnd);
      player.removeEventListener('error', onError);
    };
  }, [onStepChange]);

  useEffect(() => {
    if (!seekRequest) return;
    const player = playerRef.current;
    player?.pause();
    player?.seekTo(seekRequest.frame);
    chapterPreviewRef.current = true;
  }, [seekRequest]);

  useEffect(() => {
    // Never keep a hidden tutorial drawing frames or resume it unexpectedly.
    const pauseWhenHidden = () => { if (document.hidden) playerRef.current?.pause(); };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => {
      setReducedMotion(reducedMotion.matches);
      if (reducedMotion.matches) playerRef.current?.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) playerRef.current?.pause();
    });
    if (containerRef.current) observer.observe(containerRef.current);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    reducedMotion.addEventListener('change', onMotionChange);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, []);

  const toggle = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.getCurrentFrame() >= WORKFLOW_DURATION - 1) player.seekTo(0);
    else if (chapterPreviewRef.current) player.seekTo(workflowStepAtFrame(player.getCurrentFrame()) * WORKFLOW_STEP_FRAMES);
    chapterPreviewRef.current = false;
    player.toggle();
  };

  return (
    <div ref={containerRef} className="workflow-video" data-playing={playing} data-layout={compact ? 'portrait' : 'landscape'}>
      <div aria-hidden="true" className="workflow-canvas">
        <Player
          ref={playerRef}
          component={WorkflowComposition}
          inputProps={inputProps}
          compositionWidth={compact ? 720 : 1200}
          compositionHeight={compact ? 960 : 750}
          durationInFrames={WORKFLOW_DURATION}
          fps={WORKFLOW_FPS}
          initialFrame={15}
          controls={false}
          autoPlay={false}
          loop={false}
          moveToBeginningWhenEnded={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          numberOfSharedAudioTags={0}
          style={{ width: '100%' }}
          errorFallback={() => <div className="workflow-video-error">The preview is unavailable. Follow the seven steps below.</div>}
        />
      </div>
      {failed && <p role="status" className="workflow-error-note">Video preview unavailable. The written walkthrough is still available.</p>}
      <div className="workflow-controls" role="group" aria-label="Walkthrough playback controls">
        <button type="button" className="workflow-play" onClick={toggle} disabled={failed} aria-label={playing ? 'Pause walkthrough' : frame >= WORKFLOW_DURATION - 1 ? 'Replay walkthrough' : 'Play walkthrough'}>
          {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          <span>{playing ? 'Pause' : frame >= WORKFLOW_DURATION - 1 ? 'Replay' : 'Play tour'}</span>
        </button>
        <button type="button" className="workflow-restart" aria-label="Restart walkthrough" title="Restart walkthrough" disabled={failed} onClick={() => { chapterPreviewRef.current = false; playerRef.current?.pause(); playerRef.current?.seekTo(0); }}><RotateCcw size={16} /></button>
        <input
          className="workflow-scrubber"
          type="range"
          min={0}
          max={WORKFLOW_DURATION - 1}
          value={frame}
          style={{ '--workflow-progress': `${frame / (WORKFLOW_DURATION - 1) * 100}%` } as CSSProperties}
          disabled={failed}
          aria-label="Walkthrough progress"
          aria-valuetext={`${workflowTime(frame)} of ${workflowTime(WORKFLOW_DURATION)}`}
          onChange={(event) => { chapterPreviewRef.current = false; playerRef.current?.pause(); playerRef.current?.seekTo(Number(event.target.value)); }}
        />
        <span className="workflow-time" aria-hidden="true">{workflowTime(frame)}<span> / {workflowTime(WORKFLOW_DURATION)}</span></span>
      </div>
    </div>
  );
}
