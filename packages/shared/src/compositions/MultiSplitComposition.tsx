/**
 * MultiSplitComposition — multi-region layouts where every region is a crop
 * of the same source video drawn at a sub-rect of the output.
 *
 * Supports: 'gameplay', 'split-2v', 'split-3', 'split-4'.
 *
 * Each region is `{ out: {x,y,w,h}, src: {x,y,w,h} }` in normalized [0,1]
 * coords. The source is rendered inside a clipped container that's scaled so
 * the cropped portion fills the region — no pixel surgery, just CSS transforms.
 *
 * Title / captions / logo / music / B-roll all sit on top exactly like in
 * ClipComposition, so the only difference is the video layer.
 */

import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence } from 'remotion';
import { TitleOverlay } from './TitleOverlay';
import { SubtitleOverlay } from './SubtitleOverlay';
import { LogoOverlay } from './LogoOverlay';
import type { ClipCompositionProps, BrollInsert } from './ClipComposition';

export type SplitLayout = 'gameplay' | 'split-2v' | 'split-3' | 'split-4';

type Rect01 = { x: number; y: number; w: number; h: number };
type LayoutRegion = { out: Rect01; src: Rect01 };

function clampRect01(r: Rect01): Rect01 {
  const x = Math.max(0, Math.min(1, r.x));
  const y = Math.max(0, Math.min(1, r.y));
  const w = Math.max(0.05, Math.min(1 - x, r.w));
  const h = Math.max(0.05, Math.min(1 - y, r.h));
  return { x, y, w, h };
}

export function getSplitRegions(layout: SplitLayout): LayoutRegion[] {
  switch (layout) {
    case 'split-2v':
      return [
        { out: { x: 0, y: 0, w: 0.5, h: 1 }, src: { x: 0, y: 0, w: 0.5, h: 1 } },
        { out: { x: 0.5, y: 0, w: 0.5, h: 1 }, src: { x: 0.5, y: 0, w: 0.5, h: 1 } },
      ];
    case 'split-3':
      return [
        { out: { x: 0, y: 0, w: 1 / 3, h: 1 }, src: { x: 0, y: 0, w: 1 / 3, h: 1 } },
        { out: { x: 1 / 3, y: 0, w: 1 / 3, h: 1 }, src: { x: 1 / 3, y: 0, w: 1 / 3, h: 1 } },
        { out: { x: 2 / 3, y: 0, w: 1 / 3, h: 1 }, src: { x: 2 / 3, y: 0, w: 1 / 3, h: 1 } },
      ];
    case 'split-4':
      return [
        { out: { x: 0, y: 0, w: 0.5, h: 0.5 }, src: { x: 0, y: 0, w: 0.5, h: 0.5 } },
        { out: { x: 0.5, y: 0, w: 0.5, h: 0.5 }, src: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
        { out: { x: 0, y: 0.5, w: 0.5, h: 0.5 }, src: { x: 0, y: 0.5, w: 0.5, h: 0.5 } },
        { out: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, src: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
      ];
    case 'gameplay':
      return [
        { out: { x: 0.2, y: 0, w: 0.6, h: 0.35 }, src: clampRect01({ x: 0.35, y: 0.05, w: 0.3, h: 0.4 }) },
        { out: { x: 0, y: 0.35, w: 1, h: 0.65 }, src: { x: 0, y: 0, w: 1, h: 1 } },
      ];
  }
}

/**
 * Renders one OffthreadVideo cropped to `src` and positioned at `out`.
 * The video is wrapped in a clipped container scaled so the requested crop
 * fills the region exactly. We translate by -src.x / -src.y (scaled) so the
 * crop's top-left aligns with the region's top-left.
 */
function CroppedRegion({ src, region }: { src: string; region: LayoutRegion }) {
  const { out, src: crop } = region;
  // 1/crop.w → percent of container that the un-cropped video spans.
  // -crop.x * (1/crop.w) → shift so crop's left aligns with container's left.
  const innerW = (1 / crop.w) * 100;
  const innerH = (1 / crop.h) * 100;
  const innerLeft = -(crop.x / crop.w) * 100;
  const innerTop = -(crop.y / crop.h) * 100;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${out.x * 100}%`,
        top: `${out.y * 100}%`,
        width: `${out.w * 100}%`,
        height: `${out.h * 100}%`,
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${innerLeft}%`,
          top: `${innerTop}%`,
          width: `${innerW}%`,
          height: `${innerH}%`,
        }}
      >
        <OffthreadVideo
          src={src}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </div>
  );
}

export interface MultiSplitCompositionProps extends ClipCompositionProps {
  layout: SplitLayout;
}

export const MultiSplitComposition: React.FC<MultiSplitCompositionProps> = (props) => {
  const {
    videoSrc, title, entries, clipStartSec,
    musicSrc, musicVolume, logoSrc, logoX, logoY, logoSize, logoOpacity,
    titleFontSize, titleFontColor, titleBgColor, titleBgOpacity, titlePadding,
    titlePosition, titlePositionY, titleBorderRadius, titleMaxChars, titleFontName,
    titleHighlightColor, titleAccentColor, titleWordColors,
    subtitlePrimaryColor, subtitleHighlightColor, subtitleOutlineColor,
    subtitleOutlineWidth, subtitleFontSize, subtitleFontName, subtitleBold,
    subtitleMarginV, subtitlePreset,
    brolls,
    layout,
  } = props;

  const regions = getSplitRegions(layout);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {regions.map((region, i) => (
        <CroppedRegion key={i} src={videoSrc} region={region} />
      ))}
      {musicSrc && <Audio src={musicSrc} volume={musicVolume ?? 0.1} />}
      {brolls?.map((b: BrollInsert, i: number) => (
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
