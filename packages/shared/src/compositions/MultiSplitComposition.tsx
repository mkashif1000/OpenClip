import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoLayer } from './VideoLayer';
import { CompositionOverlays } from './CompositionOverlays';
import { CroppedVideoRegion } from './CroppedVideoRegion';
import { getSplitRegions, getRegionRect, type Rect01 } from '../rendering/geometry';
import type { ClipCompositionProps } from './ClipComposition';
export { getSplitRegions } from '../rendering/geometry';
export type SplitLayout = 'pip' | 'gameplay' | 'split-2v' | 'split-2h' | 'split-3' | 'split-4';

export interface MultiSplitCompositionProps extends ClipCompositionProps {
  layout: SplitLayout;
  regionCrops?: Rect01[];
  splitStartSec?: number;
  splitEndSec?: number;
}

export function MultiSplitComposition(props: MultiSplitCompositionProps) {
  const { videoSrc, clipStartSec, musicSrc, musicVolume, brolls, layout, regionCrops, splitStartSec, splitEndSec } = props;
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const splitActive = splitStartSec == null || splitEndSec == null || (t >= splitStartSec && t <= splitEndSec);
  return <AbsoluteFill style={{ backgroundColor: 'black' }}>
    {splitActive ? getSplitRegions(layout).map((region, i) => <CroppedVideoRegion key={i}
      src={videoSrc} clipStartSec={clipStartSec} muted={i > 0}
      out={getRegionRect(region.out, width, height)} crop={regionCrops?.[i] ?? region.src} />)
      : <VideoLayer videoSrc={videoSrc} clipStartSec={clipStartSec} />}
    {musicSrc && <Audio src={musicSrc} volume={musicVolume ?? 0.1} />}
    {brolls?.map((b, i) => <Sequence key={i} from={b.startFrame} durationInFrames={b.durationInFrames} layout="none">
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <OffthreadVideo src={b.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
      </AbsoluteFill>
    </Sequence>)}
    <CompositionOverlays {...props} />
  </AbsoluteFill>;
}
