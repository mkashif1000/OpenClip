import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Video, useVideoConfig, getRemotionEnvironment } from 'remotion';
import { TitleOverlay } from './TitleOverlay';
import { SubtitleOverlay } from './SubtitleOverlay';
import { LogoOverlay } from './LogoOverlay';

interface SubtitleEntry {
  start: string;
  end: string;
  text: string;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CroppedVideoRegionProps {
  src: string;
  cropBox: CropBox;
  containerWidth: number;
  containerHeight: number;
  top: number;
  trimBefore?: number;
}

const CroppedVideoRegion: React.FC<CroppedVideoRegionProps> = ({
  src,
  cropBox,
  containerWidth,
  containerHeight,
  top,
  trimBefore = 0,
}) => {
  const scaleX = 100 / cropBox.width;
  const scaleY = 100 / cropBox.height;
  const offsetX = -(cropBox.x * scaleX);
  const offsetY = -(cropBox.y * scaleY);

  // Use Video in Player (browser preview) and OffthreadVideo in renderer
  const VideoComponent = getRemotionEnvironment().isRendering ? OffthreadVideo : Video;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: containerWidth,
        height: containerHeight,
        overflow: 'hidden',
      }}
    >
      <VideoComponent
        src={src}
        trimBefore={trimBefore}
        style={{
          position: 'absolute',
          width: `${scaleX * 100}%`,
          height: `${scaleY * 100}%`,
          left: `${offsetX}%`,
          top: `${offsetY}%`,
          // 'fill' maps source pixels linearly onto the scaled box — the same
          // src-rect → dst-rect mapping the canvas export uses. 'cover' would
          // re-crop inside the box and show a different region than selected.
          objectFit: 'fill',
        }}
      />
    </div>
  );
};

export interface PIPCompositionProps {
  videoSrc: string;
  title: string;
  entries: SubtitleEntry[];
  clipStartSec: number;

  // PIP layout
  pipContentBox: CropBox;
  pipSpeakerBox: CropBox;
  pipSplitRatio?: number; // default 60

  // Background music
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

export const PIPComposition: React.FC<PIPCompositionProps> = ({
  videoSrc,
  title,
  entries,
  clipStartSec,
  pipContentBox,
  pipSpeakerBox,
  pipSplitRatio = 60,
  musicSrc,
  musicVolume,
  logoSrc,
  logoX,
  logoY,
  logoSize,
  logoOpacity,
  titleFontSize,
  titleFontColor,
  titleBgColor,
  titleBgOpacity,
  titlePadding,
  titlePosition,
  titlePositionY,
  titleBorderRadius,
  titleMaxChars,
  subtitlePrimaryColor,
  subtitleHighlightColor,
  subtitleOutlineColor,
  subtitleOutlineWidth,
  subtitleFontSize,
  subtitleFontName,
  subtitleBold,
  subtitleMarginV,
  subtitlePreset,
}) => {
  const { width, height, fps } = useVideoConfig();
  const contentHeight = Math.round((height * pipSplitRatio) / 100);
  const speakerHeight = height - contentHeight;
  const trimBefore = Math.round(clipStartSec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {musicSrc && <Audio src={musicSrc} volume={musicVolume ?? 0.1} />}
      {/* Content region (top) */}
      <CroppedVideoRegion
        src={videoSrc}
        cropBox={pipContentBox}
        containerWidth={width}
        containerHeight={contentHeight}
        top={0}
        trimBefore={trimBefore}
      />

      {/* Speaker region (bottom) */}
      <CroppedVideoRegion
        src={videoSrc}
        cropBox={pipSpeakerBox}
        containerWidth={width}
        containerHeight={speakerHeight}
        top={contentHeight}
        trimBefore={trimBefore}
      />

      {logoSrc && <LogoOverlay logoSrc={logoSrc} logoX={logoX} logoY={logoY} logoSize={logoSize} logoOpacity={logoOpacity} />}

      {/* Divider line between regions */}
      <div
        style={{
          position: 'absolute',
          top: contentHeight - 1,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      />

      <TitleOverlay
        title={title}
        fontSize={titleFontSize}
        fontColor={titleFontColor}
        bgColor={titleBgColor}
        bgOpacity={titleBgOpacity}
        padding={titlePadding}
        position={titlePosition}
        positionY={titlePositionY}
        borderRadius={titleBorderRadius}
        maxCharsPerLine={titleMaxChars}
      />
      <SubtitleOverlay
        entries={entries}
        clipStartSec={clipStartSec}
        primaryColor={subtitlePrimaryColor}
        highlightColor={subtitleHighlightColor}
        outlineColor={subtitleOutlineColor}
        outlineWidth={subtitleOutlineWidth}
        fontSize={subtitleFontSize}
        fontName={subtitleFontName}
        bold={subtitleBold}
        marginV={subtitleMarginV}
        preset={subtitlePreset}
      />
    </AbsoluteFill>
  );
};
