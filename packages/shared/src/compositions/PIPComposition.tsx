import { AbsoluteFill, Audio, useVideoConfig } from 'remotion';
import { CompositionOverlays } from './CompositionOverlays';
import { CroppedVideoRegion } from './CroppedVideoRegion';
import { getPipRegions } from '../rendering/geometry';
import type { ClipCompositionProps } from './ClipComposition';
import type { PIPBox } from '../types/index';

export interface PIPCompositionProps extends ClipCompositionProps {
  pipContentBox: PIPBox;
  pipSpeakerBox: PIPBox;
  pipSplitRatio?: number;
}

export function PIPComposition(props: PIPCompositionProps) {
  const { width, height } = useVideoConfig();
  const regions = getPipRegions(width, height, props.pipSplitRatio);
  const crops = [props.pipContentBox, props.pipSpeakerBox];
  return <AbsoluteFill style={{ backgroundColor: 'black' }}>
    {regions.map((out, i) => <CroppedVideoRegion key={i} src={props.videoSrc} out={out}
      clipStartSec={props.clipStartSec} muted={i > 0}
      crop={{ x: crops[i].x / 100, y: crops[i].y / 100, w: crops[i].width / 100, h: crops[i].height / 100 }} />)}
    <div style={{ position: 'absolute', top: regions[0].h - 1, left: 0, width, height: 2, background: 'rgba(0,0,0,0.5)' }} />
    {props.musicSrc && <Audio src={props.musicSrc} volume={props.musicVolume ?? 0.1} />}
    <CompositionOverlays {...props} />
  </AbsoluteFill>;
}
