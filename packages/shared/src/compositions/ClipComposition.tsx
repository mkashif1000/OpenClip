import type { SubtitleStyle as RenderSubtitleStyle, TitleStyle as RenderTitleStyle } from '../rendering/overlays';
import { AbsoluteFill, Audio, Sequence, OffthreadVideo, useVideoConfig } from 'remotion';
import { VideoLayer } from './VideoLayer';
import { CompositionOverlays } from './CompositionOverlays';
import { getBoxRect } from '../rendering/geometry';

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
  titleEnabled?: boolean;
  titleStyle?: RenderTitleStyle;
  subtitleStyle?: RenderSubtitleStyle;
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
  /** Max title width as % of frame width (width-based wrapping). */
  titleMaxWidthPct?: number;
  titleFontName?: string;
  titleHighlightColor?: string;
  titleAccentColor?: string;
  titleWordColors?: number[];

  // Boxed layout: video sits in a centered rounded inset on a black bg.
  boxed?: boolean;
  /** Corner radius (composition px) of the boxed inset. */
  boxRadiusPx?: number;
  /** Boxed inset geometry as % of frame (centered horizontally). */
  boxWidthPct?: number;
  boxHeightPct?: number;
  boxYPct?: number;

  /** Max caption width as % of frame width. */
  subtitleMaxWidthPct?: number;

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

export function ClipComposition(props: ClipCompositionProps) {
  const { videoSrc, clipStartSec, musicSrc, musicVolume, brolls } = props;
  const { width, height } = useVideoConfig();
  const box = getBoxRect(width, height, { widthPct: props.boxWidthPct, heightPct: props.boxHeightPct,
    yPct: props.boxYPct, radius: props.boxRadiusPx });
  return <AbsoluteFill style={{ backgroundColor: 'black' }}>
    {props.boxed ? <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w,
      height: box.h, borderRadius: box.radius, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoLayer videoSrc={videoSrc} clipStartSec={clipStartSec} />
    </div> : <VideoLayer videoSrc={videoSrc} clipStartSec={clipStartSec} />}
    {musicSrc && <Audio src={musicSrc} volume={musicVolume ?? 0.1} />}
    {brolls?.map((b, i) => <Sequence key={i} from={b.startFrame} durationInFrames={b.durationInFrames} layout="none">
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <OffthreadVideo src={b.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
      </AbsoluteFill>
    </Sequence>)}
    <CompositionOverlays {...props} />
  </AbsoluteFill>;
}
