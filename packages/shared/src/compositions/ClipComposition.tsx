import React from 'react';
import { AbsoluteFill, Audio, Sequence, OffthreadVideo } from 'remotion';
import { VideoLayer } from './VideoLayer';
import { TitleOverlay } from './TitleOverlay';
import { SubtitleOverlay } from './SubtitleOverlay';
import { LogoOverlay } from './LogoOverlay';

/** Single B-roll insert overlaid on the source. */
export interface BrollInsert {
  src: string;            // blob URL of the B-roll clip
  startFrame: number;     // output frame index (0-based, fps=30)
  durationInFrames: number;
}

interface SubtitleEntry {
  start: string;
  end: string;
  text: string;
}

export interface ClipCompositionProps {
  videoSrc: string;
  title: string;
  entries: SubtitleEntry[];
  clipStartSec: number;

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
  titleFontName?: string;
  titleHighlightColor?: string;
  titleAccentColor?: string;
  titleWordColors?: number[];

  // Boxed layout: video sits in a centered rounded inset on a black bg.
  boxed?: boolean;
  /** Corner radius (composition px) of the boxed inset. */
  boxRadiusPx?: number;

  // B-roll inserts overlaid on the source for their span
  brolls?: BrollInsert[];

  // Background music
  musicSrc?: string;
  musicVolume?: number;

  // Logo
  logoSrc?: string;
  logoX?: number;
  logoY?: number;
  logoSize?: number;
  logoOpacity?: number;

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

export const ClipComposition: React.FC<ClipCompositionProps> = ({
  videoSrc,
  title,
  entries,
  clipStartSec,
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
  titleFontName,
  titleHighlightColor,
  titleAccentColor,
  titleWordColors,
  boxed,
  boxRadiusPx,
  brolls,
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
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {boxed ? (
        // Boxed layout — video in a centered rounded inset on black. Geometry
        // matches drawBoxedLayout in the canvas renderer (left 8%, top 20%,
        // 84% × 52%) so preview == export.
        <div
          style={{
            position: 'absolute',
            left: '8%',
            top: '20%',
            width: '84%',
            height: '52%',
            borderRadius: boxRadiusPx ?? 40,
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          <VideoLayer videoSrc={videoSrc} clipStartSec={clipStartSec} />
        </div>
      ) : (
        <VideoLayer videoSrc={videoSrc} clipStartSec={clipStartSec} />
      )}
      {musicSrc && <Audio src={musicSrc} volume={musicVolume ?? 0.1} />}
      {/* ── B-roll inserts: each Sequence is rendered ABOVE the source for
            its window, replacing what the viewer sees. Captions + title +
            logo render on top so they stay visible during B-roll. ── */}
      {brolls?.map((b, i) => (
        <Sequence key={i} from={b.startFrame} durationInFrames={b.durationInFrames} layout="none">
          <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <OffthreadVideo src={b.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
          </AbsoluteFill>
        </Sequence>
      ))}
      {logoSrc && <LogoOverlay logoSrc={logoSrc} logoX={logoX} logoY={logoY} logoSize={logoSize} logoOpacity={logoOpacity} />}
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
        fontName={titleFontName}
        highlightColor={titleHighlightColor}
        accentColor={titleAccentColor}
        wordColors={titleWordColors}
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
