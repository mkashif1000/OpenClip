import React from 'react';
import { Composition } from 'remotion';
import { ClipComposition } from './ClipComposition';
import { PIPComposition } from './PIPComposition';
import { HybridComposition } from './HybridComposition';
import type { ClipCompositionProps } from './ClipComposition';
import type { PIPCompositionProps } from './PIPComposition';
import type { HybridCompositionProps } from './HybridComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ClipComposition"
        component={ClipComposition as any}
        durationInFrames={900}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          videoSrc: '',
          title: 'Sample Title',
          entries: [],
          clipStartSec: 0,
        } satisfies ClipCompositionProps}
      />
      <Composition
        id="PIPComposition"
        component={PIPComposition as any}
        durationInFrames={900}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          videoSrc: '',
          title: 'Sample Title',
          entries: [],
          clipStartSec: 0,
          pipContentBox: { x: 0, y: 0, width: 100, height: 50 },
          pipSpeakerBox: { x: 0, y: 50, width: 30, height: 30 },
          pipSplitRatio: 60,
        } satisfies PIPCompositionProps}
      />
      <Composition
        id="HybridComposition"
        component={HybridComposition as any}
        durationInFrames={900}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          videoSrc: '',
          title: 'Sample Title',
          entries: [],
          clipStartSec: 0,
          pipContentBox: { x: 0, y: 0, width: 100, height: 50 },
          pipSpeakerBox: { x: 0, y: 50, width: 30, height: 30 },
          pipStartSec: 0,
          pipEndSec: 15,
        } satisfies HybridCompositionProps}
      />
    </>
  );
};
