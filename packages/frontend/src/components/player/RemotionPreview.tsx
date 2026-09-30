import { subtitleStyleFromConfig } from '@viral-clipper/shared/rendering/subtitleConfig';
import { titleStyleFromConfig } from '@viral-clipper/shared/rendering/titleConfig';
import { Player, type PlayerRef } from '@remotion/player';
import {
  ClipComposition, PIPComposition, HybridComposition, MultiSplitComposition,
  type SplitLayout,
} from '@viral-clipper/shared/compositions';
import { useStyleStore } from '@/stores/styleStore';
import type { ClipData, SubtitleStyle, TitleStyle, PIPBox } from '@/types';
import { getPerformanceProfile } from '@/services/performanceProfile';

export type { PlayerRef };

interface PipPreviewOverride {
  contentBox: PIPBox;
  speakerBox: PIPBox;
  splitRatio: number;
  pipStartSec?: number;
  pipEndSec?: number;
}

interface RemotionPreviewProps {
  clip?: ClipData | null;
  videoSegmentUrl: string;
  musicSrc?: string;
  musicVolume?: number;
  logoSrc?: string;
  logoX?: number;
  logoY?: number;
  logoSize?: number;
  logoOpacity?: number;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  style?: React.CSSProperties;
  // Overrides for per-clip customization (Re-PIP modal)
  overrideSubtitle?: SubtitleStyle;
  overrideTitle?: TitleStyle;
  overridePip?: PipPreviewOverride;
  /** Forwarded ref to the underlying Remotion Player for external control. */
  playerRef?: React.Ref<PlayerRef>;
  /** Per-clip B-roll inserts, in OUTPUT-frame coordinates. */
  brolls?: Array<{ src: string; startFrame: number; durationInFrames: number }>;
  /** Override the title font family (clip.edits.titleFont). */
  titleFontName?: string;
  /** Force a multi-source split layout (gameplay / split-2v / split-2h / split-3 / split-4). */
  splitLayout?: SplitLayout;
  /** Per-region source crops for split layouts (normalized [0,1], region order). */
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }>;
  /** Clip-relative window (seconds) the split layout applies in. */
  splitRange?: { start: number; end: number } | null;
  /** Per-word color tiers for the title (multi-color titles). */
  titleWordColors?: number[];
  /** Render the boxed layout (centered rounded inset on black). */
  boxed?: boolean;
  /** Boxed inset corner radius in composition px. */
  boxRadiusPx?: number;
  /** Boxed inset geometry as % of frame (centered horizontally). */
  boxWidthPct?: number;
  boxHeightPct?: number;
  boxYPct?: number;
}

export function RemotionPreview({
  clip,
  videoSegmentUrl,
  musicSrc,
  musicVolume,
  logoSrc,
  logoX,
  logoY,
  logoSize,
  logoOpacity,
  width,
  height,
  autoPlay = true,
  controls = true,
  loop = true,
  style,
  overrideSubtitle,
  overrideTitle,
  overridePip,
  playerRef,
  brolls,
  titleFontName,
  splitLayout,
  regionCrops,
  splitRange,
  titleWordColors,
  boxed,
  boxRadiusPx,
  boxWidthPct,
  boxHeightPct,
  boxYPct,
}: RemotionPreviewProps) {
  const { styles } = useStyleStore();
  const { export: exp } = styles;
  const subtitle = overrideSubtitle ?? styles.subtitle;
  const title = overrideTitle ?? styles.title;

  const sourceWidth = width ?? exp.width;
  const sourceHeight = height ?? exp.height;
  // Keep final exports untouched, but render the interactive preview at a
  // device-appropriate size so Remotion does not rasterize 1080p frames on a
  // low-memory laptop while the user is scrubbing.
  const previewLimit = getPerformanceProfile().previewWidth;
  const previewScale = Math.min(1, previewLimit / Math.max(sourceWidth, sourceHeight));
  const compWidth = Math.max(2, Math.round(sourceWidth * previewScale));
  const compHeight = Math.max(2, Math.round(sourceHeight * previewScale));
  const fps = 30;
  const duration = clip?.duration ?? 30;
  const durationInFrames = Math.max(Math.ceil(duration * fps), 1);


  // Determine which composition to use. Split/gameplay layouts win when set,
  // otherwise we fall back to the PIP override or the plain ClipComposition.
  const hasPartialPip = overridePip && overridePip.pipStartSec != null && overridePip.pipEndSec != null;
  const hasFullPip = overridePip && !hasPartialPip;
  const Component = splitLayout
    ? MultiSplitComposition
    : hasPartialPip ? HybridComposition : hasFullPip ? PIPComposition : ClipComposition;

  const baseProps: Record<string, any> = {
    videoSrc: videoSegmentUrl,
    title: clip?.edits?.customTitle ?? clip?.title ?? 'Sample Title That Wraps to Multiple Lines',
    entries: clip?.entries ?? [],
    clipStartSec: clip?.start_time ?? 0,
    // Title style
    titleStyle: titleStyleFromConfig({ ...title, font_name: titleFontName ?? clip?.edits?.titleFont ?? title.font_name }, compWidth, compHeight, titleWordColors ?? clip?.edits?.titleColors),
    titleEnabled: title.enabled,
    titleFontSize: title.font_size ?? undefined,
    titleFontColor: title.font_color,
    titleBgColor: title.bg_color,
    titleBgOpacity: title.bg_opacity,
    titlePadding: title.padding,
    titlePosition: title.position as 'top' | 'center' | 'bottom',
    titlePositionY: title.position_y,
    titleBorderRadius: title.border_radius,
    titleMaxChars: title.max_chars_per_line ?? undefined,
    ...(title.max_width != null ? { titleMaxWidthPct: title.max_width } : {}),
    titleFontName: titleFontName ?? clip?.edits?.titleFont ?? title.font_name,
    titleHighlightColor: title.highlight_color ?? '#FFD23F',
    titleAccentColor: title.accent_color ?? '#FF4D4D',
    titleWordColors: titleWordColors ?? clip?.edits?.titleColors,
    // Boxed layout (centered rounded inset) — only meaningful for ClipComposition.
    ...(boxed ? { boxed: true, boxRadiusPx, boxWidthPct, boxHeightPct, boxYPct } : {}),
    // Pass through B-roll overlays so the live preview shows what the export
    // will actually render at each broll span.
    ...(brolls && brolls.length ? { brolls } : {}),
    // MultiSplitComposition needs the layout name to pick its regions.
    ...(splitLayout ? { layout: splitLayout } : {}),
    ...(splitLayout && regionCrops && regionCrops.length ? { regionCrops } : {}),
    ...(splitLayout && splitRange ? { splitStartSec: splitRange.start, splitEndSec: splitRange.end } : {}),
    // Subtitle style
    subtitleStyle: subtitleStyleFromConfig(subtitle, compWidth, compHeight),
    subtitlePrimaryColor: subtitle.primary_color,
    subtitleHighlightColor: subtitle.highlight_color,
    subtitleOutlineColor: subtitle.outline_color,
    subtitleOutlineWidth: subtitle.outline_width,
    subtitleFontSize: subtitle.font_size ?? undefined,
    subtitleFontName: subtitle.font_name,
    subtitleBold: subtitle.bold,
    subtitleMarginV: subtitle.margin_v ?? undefined,
    ...(subtitle.max_width != null ? { subtitleMaxWidthPct: subtitle.max_width } : {}),
    subtitlePreset: subtitle.preset ?? 'karaoke',
    // Background music
    ...(musicSrc ? { musicSrc, musicVolume: musicVolume ?? 0.1 } : {}),
    // Logo overlay
    ...(logoSrc ? { logoSrc, logoX, logoY, logoSize, logoOpacity } : {}),
  };

  // Add PIP-specific props if needed
  if (overridePip) {
    baseProps.pipContentBox = overridePip.contentBox;
    baseProps.pipSpeakerBox = overridePip.speakerBox;
    baseProps.pipSplitRatio = overridePip.splitRatio;
    if (hasPartialPip) {
      baseProps.pipStartSec = overridePip.pipStartSec;
      baseProps.pipEndSec = overridePip.pipEndSec;
    }
  }

  return (
    <Player
      ref={playerRef}
      component={Component as any}
      inputProps={baseProps}
      durationInFrames={durationInFrames}
      fps={fps}
      compositionWidth={compWidth}
      compositionHeight={compHeight}
      style={{ width: '100%', ...style }}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
    />
  );
}
