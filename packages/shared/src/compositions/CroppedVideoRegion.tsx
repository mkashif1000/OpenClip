import { OffthreadVideo, Video, useVideoConfig, getRemotionEnvironment } from 'remotion';
import { cropVideoStyle, type Rect01 } from '../rendering/geometry';

export function CroppedVideoRegion({ src, crop, out, clipStartSec, muted = false }: {
  src: string; crop: Rect01; out: Rect01; clipStartSec: number; muted?: boolean;
}) {
  const { fps } = useVideoConfig();
  const VideoComponent = getRemotionEnvironment().isRendering ? OffthreadVideo : Video;
  return <div style={{ position: 'absolute', left: out.x, top: out.y, width: out.w, height: out.h,
    overflow: 'hidden', background: '#000' }}>
    <VideoComponent src={src} trimBefore={Math.round(clipStartSec * fps)} muted={muted}
      style={cropVideoStyle(crop)} />
  </div>;
}
