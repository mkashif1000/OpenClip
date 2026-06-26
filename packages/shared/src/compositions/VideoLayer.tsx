import React from 'react';
import { OffthreadVideo, Video, useVideoConfig, getRemotionEnvironment } from 'remotion';

interface VideoLayerProps {
  videoSrc: string;
  /** Seconds into the source video where this clip begins. The video is
   *  trimmed so composition frame 0 maps to this point — letting previews
   *  play the full source file directly (no server-side segment extraction). */
  clipStartSec?: number;
}

export const VideoLayer: React.FC<VideoLayerProps> = ({ videoSrc, clipStartSec = 0 }) => {
  const { fps } = useVideoConfig();
  // Video in Player (browser preview), OffthreadVideo in renderer (frame-accurate)
  const VideoComponent = getRemotionEnvironment().isRendering ? OffthreadVideo : Video;
  return (
    <VideoComponent
      src={videoSrc}
      trimBefore={Math.round(clipStartSec * fps)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
};
