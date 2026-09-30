import { TitleOverlay } from './TitleOverlay';
import { SubtitleOverlay } from './SubtitleOverlay';
import { LogoOverlay } from './LogoOverlay';
import type { ClipCompositionProps } from './ClipComposition';

export function CompositionOverlays(p: ClipCompositionProps) {
  return <>
    {p.logoSrc && <LogoOverlay logoSrc={p.logoSrc} logoX={p.logoX} logoY={p.logoY} logoSize={p.logoSize} logoOpacity={p.logoOpacity} />}
    <TitleOverlay enabled={p.titleEnabled} title={p.title} fontSize={p.titleFontSize} fontColor={p.titleFontColor}
      bgColor={p.titleBgColor} bgOpacity={p.titleBgOpacity} padding={p.titlePadding}
      position={p.titlePosition} positionY={p.titlePositionY} borderRadius={p.titleBorderRadius}
      maxCharsPerLine={p.titleMaxChars} maxWidthPct={p.titleMaxWidthPct} fontName={p.titleFontName}
      highlightColor={p.titleHighlightColor} accentColor={p.titleAccentColor} wordColors={p.titleWordColors} {...p.titleStyle} />
    <SubtitleOverlay entries={p.entries} clipStartSec={p.clipStartSec}
      primaryColor={p.subtitlePrimaryColor} highlightColor={p.subtitleHighlightColor}
      outlineColor={p.subtitleOutlineColor} outlineWidth={p.subtitleOutlineWidth}
      fontSize={p.subtitleFontSize} fontName={p.subtitleFontName} bold={p.subtitleBold}
      marginV={p.subtitleMarginV} maxWidthPct={p.subtitleMaxWidthPct} preset={p.subtitlePreset} {...p.subtitleStyle} />
  </>;
}
