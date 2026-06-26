import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Video, useCurrentFrame, useVideoConfig, getRemotionEnvironment } from 'remotion';
import { TitleOverlay } from './TitleOverlay';
import { SubtitleOverlay } from './SubtitleOverlay';
import { LogoOverlay } from './LogoOverlay';

interface SubtitleEntry { start: string; end: string; text: string; }
interface CropBox { x: number; y: number; width: number; height: number; }

const CroppedVideoRegion: React.FC<{
  src: string; cropBox: CropBox; containerWidth: number; containerHeight: number; top: number; trimBefore?: number;
}> = ({ src, cropBox, containerWidth, containerHeight, top, trimBefore = 0 }) => {
  const scaleX = 100 / cropBox.width;
  const scaleY = 100 / cropBox.height;
  const offsetX = -(cropBox.x * scaleX);
  const offsetY = -(cropBox.y * scaleY);
  const VideoComponent = getRemotionEnvironment().isRendering ? OffthreadVideo : Video;

  return (
    <div style={{ position: 'absolute', top, left: 0, width: containerWidth, height: containerHeight, overflow: 'hidden' }}>
      <VideoComponent
        src={src}
        trimBefore={trimBefore}
        style={{
          position: 'absolute',
          width: `${scaleX * 100}%`, height: `${scaleY * 100}%`,
          left: `${offsetX}%`, top: `${offsetY}%`,
          // 'fill' = linear src→dst mapping, matching the canvas export crop.
          objectFit: 'fill',
        }}
      />
    </div>
  );
};

export interface HybridCompositionProps {
  videoSrc: string;
  title: string;
  entries: SubtitleEntry[];
  clipStartSec: number;

  // PIP config
  pipContentBox: CropBox;
  pipSpeakerBox: CropBox;
  pipSplitRatio?: number;

  // PIP time range (seconds relative to clip start)
  pipStartSec: number;
  pipEndSec: number;

  // Music
  musicSrc?: string;
  musicVolume?: number;

  // Logo
  logoSrc?: string;
  logoX?: number;
  logoY?: number;
  logoSize?: number;
  logoOpacity?: number;

  // Title style
  titleFontSize?: number;
  titleFontColor?: string;
  titleBgColor?: string;
  titleBgOpacity?: number;
  titlePadding?: number;
  titlePosition?: 'top' | 'center' | 'bottom';
  titlePositionY?: number;
  titleBorderRadius?: number;
  titleMaxChars?: number;

  // Subtitle style
  subtitlePrimaryColor?: string;
  subtitleHighlightColor?: string;
  subtitleOutlineColor?: string;
  subtitleOutlineWidth?: number;
  subtitleFontSize?: number;
  subtitleFontName?: string;
  subtitleBold?: boolean;
  subtitleMarginV?: number;
  subtitlePreset?: string;
}

export const HybridComposition: React.FC<HybridCompositionProps> = (props) => {
  const {
    videoSrc, title, entries, clipStartSec,
    pipContentBox, pipSpeakerBox, pipSplitRatio = 60,
    pipStartSec, pipEndSec,
    musicSrc, musicVolume,
    logoSrc, logoX, logoY, logoSize, logoOpacity,
    titleFontSize, titleFontColor, titleBgColor, titleBgOpacity,
    titlePadding, titlePosition, titlePositionY, titleBorderRadius, titleMaxChars,
    subtitlePrimaryColor, subtitleHighlightColor, subtitleOutlineColor,
    subtitleOutlineWidth, subtitleFontSize, subtitleFontName, subtitleBold, subtitleMarginV,
    subtitlePreset,
  } = props;

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  const inPipRange = currentTime >= pipStartSec && currentTime <= pipEndSec;

  const contentHeight = Math.round((height * pipSplitRatio) / 100);
  const speakerHeight = height - contentHeight;
  const trimBefore = Math.round(clipStartSec * fps);

  const FullVideoComponent = getRemotionEnvironment().isRendering ? OffthreadVideo : Video;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Video layer: normal or PIP depending on time */}
      {inPipRange ? (
        <>
          <CroppedVideoRegion
            src={videoSrc} cropBox={pipContentBox}
            containerWidth={width} containerHeight={contentHeight} top={0}
            trimBefore={trimBefore}
          />
          <CroppedVideoRegion
            src={videoSrc} cropBox={pipSpeakerBox}
            containerWidth={width} containerHeight={speakerHeight} top={contentHeight}
            trimBefore={trimBefore}
          />
          <div style={{
            position: 'absolute', top: contentHeight - 1, left: 0, right: 0,
            height: 2, backgroundColor: 'rgba(0,0,0,0.5)',
          }} />
        </>
      ) : (
        <FullVideoComponent
          src={videoSrc}
          trimBefore={trimBefore}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {musicSrc && <Audio src={musicSrc} volume={musicVolume ?? 0.1} />}
      {logoSrc && <LogoOverlay logoSrc={logoSrc} logoX={logoX} logoY={logoY} logoSize={logoSize} logoOpacity={logoOpacity} />}

      <TitleOverlay
        title={title} fontSize={titleFontSize} fontColor={titleFontColor}
        bgColor={titleBgColor} bgOpacity={titleBgOpacity} padding={titlePadding}
        position={titlePosition} positionY={titlePositionY} borderRadius={titleBorderRadius} maxCharsPerLine={titleMaxChars}
      />
      <SubtitleOverlay
        entries={entries} clipStartSec={clipStartSec}
        primaryColor={subtitlePrimaryColor} highlightColor={subtitleHighlightColor}
        outlineColor={subtitleOutlineColor} outlineWidth={subtitleOutlineWidth}
        fontSize={subtitleFontSize} fontName={subtitleFontName}
        bold={subtitleBold} marginV={subtitleMarginV}
        preset={subtitlePreset}
      />
    </AbsoluteFill>
  );
};
