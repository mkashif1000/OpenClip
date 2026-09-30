import { useCurrentFrame, useVideoConfig } from 'remotion';
import { ClipComposition } from './ClipComposition';
import { PIPComposition, type PIPCompositionProps } from './PIPComposition';

export interface HybridCompositionProps extends PIPCompositionProps {
  pipStartSec: number;
  pipEndSec: number;
}

export function HybridComposition(props: HybridCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inPipRange = frame / fps >= props.pipStartSec && frame / fps <= props.pipEndSec;
  return inPipRange ? <PIPComposition {...props} /> : <ClipComposition {...props} />;
}
