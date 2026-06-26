/**
 * Canvas 2D renderer — replicates all Remotion overlay compositions in pure canvas.
 * Handles: TitleOverlay, SubtitleOverlay, LogoOverlay, PIP layout.
 */

import type { ClipData, StyleConfig, SubtitleEntry, PIPConfig } from '@/types';
import { fontStack } from '@/data/fonts';
import { tierColor } from '@/lib/titleColors';

export type LayoutType =
  | 'standard'
  | 'pip'
  | 'hybrid'
  | 'gameplay'
  | 'split-2v'
  | 'split-3'
  | 'split-4'
  | 'boxed';

/** Layouts that compose multiple crops of the same source into one output. */
export const SPLIT_LAYOUTS = new Set<LayoutType>(['gameplay', 'split-2v', 'split-3', 'split-4']);

/** Anything the renderer can sample pixels from (element, decoded frame, bitmap). */
export type VideoSourceLike = HTMLVideoElement | VideoFrame | ImageBitmap;

function sourceSize(src: VideoSourceLike): { w: number; h: number } {
  const el = src as HTMLVideoElement;
  if (typeof el.videoWidth === 'number' && el.videoWidth > 0) {
    return { w: el.videoWidth, h: el.videoHeight };
  }
  const vf = src as VideoFrame;
  if (typeof vf.displayWidth === 'number' && vf.displayWidth > 0) {
    return { w: vf.displayWidth, h: vf.displayHeight };
  }
  const ib = src as ImageBitmap;
  return { w: ib.width || 0, h: ib.height || 0 };
}

export interface FrameRenderJob {
  video: VideoSourceLike;
  canvas: OffscreenCanvas | HTMLCanvasElement;
  currentTimeSec: number;    // absolute time in source video
  clipStartSec: number;
  clip: ClipData;
  styleConfig: StyleConfig;
  logoImg?: ImageBitmap | HTMLImageElement | null;
  logoConfig?: { x: number; y: number; size: number; opacity: number } | null;
  pipConfig?: PIPConfig | null;
  layoutType?: LayoutType;
  pipStartSec?: number;      // for hybrid layout
  pipEndSec?: number;
  width: number;
  height: number;
  /** Normalized (0-1) face center at this frame — pans the crop to keep the speaker centered. */
  faceCenter?: { x: number; y: number } | null;
  /** Extra zoom on the background video (Ken Burns for B-roll). 1 = none. */
  bgZoom?: number;
  /**
   * Per-region source crops (split / gameplay layouts). Same order as
   * getSplitRegions(layout); coords normalized [0,1] on the source. When
   * absent, defaults from getSplitRegions are used.
   */
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }>;
}

// ─── Main render function ─────────────────────────────────────────────────────

export function renderFrame(job: FrameRenderJob): void {
  const {
    video, canvas, currentTimeSec, clipStartSec, clip, styleConfig,
    logoImg, logoConfig, pipConfig, layoutType = 'standard',
    pipStartSec = 0, pipEndSec = 0, width, height, faceCenter = null, bgZoom = 1,
  } = job;

  const ctx = (canvas as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D
    || (canvas as OffscreenCanvas).getContext('2d') as OffscreenCanvasRenderingContext2D;

  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  // ─── Video layer ────────────────────────────────────────────────────────────
  const relativeTime = currentTimeSec - clipStartSec;

  if ((layoutType === 'hybrid') && relativeTime >= pipStartSec && relativeTime <= pipEndSec && pipConfig) {
    drawPIPLayout(ctx, video, pipConfig, width, height, faceCenter);
  } else if (layoutType === 'pip' && pipConfig) {
    drawPIPLayout(ctx, video, pipConfig, width, height, faceCenter);
  } else if (SPLIT_LAYOUTS.has(layoutType)) {
    // Multi-source split layouts: each region is a crop of the source drawn
    // at a sub-region of the output. Per-clip source crops (set in the
    // Layout Editor modal) override the auto defaults when present.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    drawSplitLayout(ctx, video, layoutType, width, height, faceCenter, job.regionCrops);
  } else if (layoutType === 'boxed') {
    // Boxed: video sits in a centered rounded-corner inset on a black bg.
    // Used by the "Boxed Video" podcast template (title above, captions below).
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    drawBoxedLayout(ctx, video, width, height, faceCenter, styleConfig.export?.box_radius);
  } else {
    // Standard full-frame video
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    drawVideoFrame(ctx, video, width, height, faceCenter, bgZoom);
    ctx.restore();
  }

  // ─── Logo overlay ───────────────────────────────────────────────────────────
  if (logoImg && logoConfig) {
    drawLogoOverlay(ctx, logoImg, {
      x: logoConfig.x ?? 50,
      y: logoConfig.y ?? 85,
      size: logoConfig.size ?? 15,
      opacity: logoConfig.opacity ?? 1,
    }, width, height);
  }

  // ─── Title overlay ──────────────────────────────────────────────────────────
  const titleStyle = styleConfig.title;
  if (clip.title) {
    drawTitleOverlay(ctx, clip.title, {
      fontSize: titleStyle.font_size || (width < 800 ? 32 : 22),
      fontColor: titleStyle.font_color || '#FFFFFF',
      bgColor: titleStyle.bg_color || '#000000',
      bgOpacity: titleStyle.bg_opacity ?? 0.75,
      padding: titleStyle.padding ?? 20,
      position: titleStyle.position as 'top' | 'center' | 'bottom' || 'top',
      positionY: titleStyle.position_y,
      borderRadius: titleStyle.border_radius ?? 6,
      maxCharsPerLine: titleStyle.max_chars_per_line || (width < 800 ? 25 : 45),
      fontName: titleStyle.font_name,
      highlightColor: titleStyle.highlight_color || '#FFD23F',
      accentColor: titleStyle.accent_color || '#FF4D4D',
      wordColors: clip.edits?.titleColors,
    }, width, height);
  }

  // ─── Subtitle overlay ───────────────────────────────────────────────────────
  const subStyle = styleConfig.subtitle;
  const entries = clip.entries || [];
  if (entries.length > 0) {
    drawSubtitleOverlay(ctx, entries, currentTimeSec, clipStartSec, {
      primaryColor: subStyle.primary_color || '#FFFFFF',
      highlightColor: subStyle.highlight_color || '#FFFF00',
      outlineColor: subStyle.outline_color || '#000000',
      outlineWidth: subStyle.outline_width ?? 4,
      fontSize: subStyle.font_size || (width < 800 ? 62 : 36),
      fontName: subStyle.font_name || 'Arial',
      bold: subStyle.bold ?? true,
      marginV: subStyle.margin_v || (width < 800 ? 120 : 60),
      preset: subStyle.preset,
    }, width, height);
  }
}

// ─── Video frame draw ─────────────────────────────────────────────────────────

function drawVideoFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: VideoSourceLike,
  width: number,
  height: number,
  faceCenter?: { x: number; y: number } | null,
  bgZoom = 1,
): void {
  // Cover-fit: maintain aspect ratio, crop to fill
  const size = sourceSize(source);
  const vw = size.w || width;
  const vh = size.h || height;
  const scale = Math.max(width / vw, height / vh);
  let sw = vw * scale;
  let sh = vh * scale;
  let sx = (width - sw) / 2;
  let sy = (height - sh) / 2;
  // Pan the crop window toward the tracked face on whichever axis overflows
  // the frame; clamped so the crop never leaves the source.
  if (faceCenter) {
    sx = clamp(width / 2 - faceCenter.x * sw, width - sw, 0);
    sy = clamp(height / 2 - faceCenter.y * sh, height - sh, 0);
  }
  // Ken Burns: scale the drawn image about the canvas centre.
  if (bgZoom && bgZoom !== 1) {
    const cx = width / 2;
    const cy = height / 2;
    sx = cx - (cx - sx) * bgZoom;
    sy = cy - (cy - sy) * bgZoom;
    sw *= bgZoom;
    sh *= bgZoom;
  }
  ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

// ─── PIP layout ───────────────────────────────────────────────────────────────

function drawPIPLayout(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  video: VideoSourceLike,
  pipConfig: PIPConfig,
  width: number,
  height: number,
  faceCenter?: { x: number; y: number } | null,
): void {
  const { contentBox, splitRatio = 60 } = pipConfig;
  let { speakerBox } = pipConfig;
  const contentHeight = Math.round((height * splitRatio) / 100);
  const speakerHeight = height - contentHeight;

  // Re-center the speaker crop box on the tracked face (box size unchanged,
  // clamped inside the source frame).
  if (faceCenter) {
    speakerBox = {
      ...speakerBox,
      x: clamp(faceCenter.x * 100 - speakerBox.width / 2, 0, 100 - speakerBox.width),
      y: clamp(faceCenter.y * 100 - speakerBox.height / 2, 0, 100 - speakerBox.height),
    };
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Draw content region (top)
  drawCroppedRegion(ctx, video, contentBox, 0, 0, width, contentHeight);

  // Draw speaker region (bottom)
  drawCroppedRegion(ctx, video, speakerBox, 0, contentHeight, width, speakerHeight);

  // Divider line
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, contentHeight - 1, width, 2);
}

// ─── Multi-source split layouts ──────────────────────────────────────────────
//
// Each split layout is defined as a list of regions; every region is a crop of
// the source video drawn into a sub-rect of the output. Coordinates are
// normalized (0..1) — the helper scales them to the actual output size and to
// the source's percent-based crop convention used by drawCroppedRegion (0..100).

type Rect01 = { x: number; y: number; w: number; h: number };
type LayoutRegion = { out: Rect01; src: Rect01 };

function clampRect01(r: Rect01): Rect01 {
  const x = Math.max(0, Math.min(1, r.x));
  const y = Math.max(0, Math.min(1, r.y));
  const w = Math.max(0.05, Math.min(1 - x, r.w));
  const h = Math.max(0.05, Math.min(1 - y, r.h));
  return { x, y, w, h };
}

/**
 * Default regions per split layout. Source crops are sensible defaults — the
 * user can iterate on these later via the Edit tab if we add per-region tuning.
 * `faceCenter` is used by the Gameplay layout so the small face-cam tracks the
 * speaker if face-tracking is on.
 */
export function getSplitRegions(
  layout: LayoutType,
  faceCenter?: { x: number; y: number } | null,
): LayoutRegion[] {
  switch (layout) {
    case 'split-2v':
      // Left/right halves; each shows the matching half of the source so a
      // 16:9 podcast with two speakers reads naturally as "speaker A | speaker B".
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
    case 'gameplay': {
      // Small face-cam on top + main content below. Same source for both, but
      // the face-cam crop is a tight box around the speaker (face-centered if
      // we have a track) and the bottom shows the full source.
      const faceCrop = faceCenter
        ? clampRect01({ x: faceCenter.x - 0.15, y: Math.max(0, faceCenter.y - 0.2), w: 0.3, h: 0.4 })
        : { x: 0.35, y: 0.05, w: 0.3, h: 0.4 };
      return [
        // Top 35% of output → small face cam
        { out: { x: 0.2, y: 0, w: 0.6, h: 0.35 }, src: faceCrop },
        // Bottom 65% of output → full source content
        { out: { x: 0, y: 0.35, w: 1, h: 0.65 }, src: { x: 0, y: 0, w: 1, h: 1 } },
      ];
    }
    default:
      return [];
  }
}

function drawSplitLayout(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  video: VideoSourceLike,
  layout: LayoutType,
  width: number,
  height: number,
  faceCenter?: { x: number; y: number } | null,
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }>,
): void {
  const regions = getSplitRegions(layout, faceCenter);
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    // User-edited crop (from Layout Editor modal) wins over the auto default.
    const srcOverride = regionCrops?.[i];
    const src = srcOverride ?? region.src;
    const cropBox = {
      x: src.x * 100,
      y: src.y * 100,
      width: src.w * 100,
      height: src.h * 100,
    };
    const dx = Math.round(region.out.x * width);
    const dy = Math.round(region.out.y * height);
    const dw = Math.round(region.out.w * width);
    const dh = Math.round(region.out.h * height);
    drawCroppedRegion(ctx, video, cropBox, dx, dy, dw, dh);
  }
}

/**
 * Boxed layout. The source video is drawn centered inside a rounded inset
 * (~78% width, ~52% height for a vertical output). Black bars above and
 * below leave room for a multi-line title and the captions. Used by the
 * "Boxed Video" podcast template.
 */
function drawBoxedLayout(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  video: VideoSourceLike,
  width: number,
  height: number,
  faceCenter?: { x: number; y: number } | null,
  boxRadius?: number,
): void {
  // Box geometry (normalized to output). Keep in sync with BOXED_RECT used by
  // the Remotion preview so what the user sees matches the export.
  const boxW = Math.round(width * 0.84);
  const boxH = Math.round(height * 0.52);
  const boxX = Math.round((width - boxW) / 2);
  // Centered with a slight lean toward top so the title gets more room than
  // the captions below — matches the screenshot the user shared.
  const boxY = Math.round(height * 0.20);
  // `boxRadius` is in OUTPUT px (configurable in the template drawer). Clamp to
  // half the smaller side (a full pill) so it never inverts.
  const radius = Math.max(0, Math.min(boxRadius ?? 40, Math.min(boxW, boxH) / 2));

  // Cover-fit the source into the box, optionally pan toward the face.
  const size = sourceSize(video);
  const vw = size.w || boxW;
  const vh = size.h || boxH;
  const scale = Math.max(boxW / vw, boxH / vh);
  let sw = vw * scale;
  let sh = vh * scale;
  let sx = (boxW - sw) / 2;
  let sy = (boxH - sh) / 2;
  if (faceCenter) {
    sx = clamp(boxW / 2 - faceCenter.x * sw, boxW - sw, 0);
    sy = clamp(boxH / 2 - faceCenter.y * sh, boxH - sh, 0);
  }

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, boxX, boxY, boxW, boxH, radius);
  ctx.clip();
  ctx.drawImage(video as CanvasImageSource, boxX + sx, boxY + sy, sw, sh);
  ctx.restore();
}

function drawCroppedRegion(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  video: VideoSourceLike,
  cropBox: { x: number; y: number; width: number; height: number },
  dstX: number, dstY: number, dstW: number, dstH: number,
): void {
  const { w: vw, h: vh } = sourceSize(video);
  // cropBox is in percentage units (0-100)
  const srcX = (cropBox.x / 100) * vw;
  const srcY = (cropBox.y / 100) * vh;
  const srcW = (cropBox.width / 100) * vw;
  const srcH = (cropBox.height / 100) * vh;

  ctx.save();
  ctx.beginPath();
  ctx.rect(dstX, dstY, dstW, dstH);
  ctx.clip();
  ctx.drawImage(video as CanvasImageSource, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
  ctx.restore();
}

// ─── Title overlay ────────────────────────────────────────────────────────────

interface TitleStyle {
  fontSize: number;
  fontColor: string;
  bgColor: string;
  bgOpacity: number;
  padding: number;
  position: 'top' | 'center' | 'bottom';
  positionY?: number | null;
  borderRadius: number;
  maxCharsPerLine: number;
  /** Font family — falls back to a safe stack if unset. */
  fontName?: string;
  /** Tier-1 / tier-2 word colors (multi-color titles). */
  highlightColor?: string;
  accentColor?: string;
  /** Per-word color tier (0/1/2), aligned to whitespace words of `title`. */
  wordColors?: number[];
}

type TitleWord = { text: string; tier: number };

/** Greedily wrap colored words into lines under maxChars (whitespace count). */
function wrapColoredWords(words: TitleWord[], maxChars: number): TitleWord[][] {
  const lines: TitleWord[][] = [];
  let cur: TitleWord[] = [];
  let len = 0;
  for (const w of words) {
    const add = (cur.length ? 1 : 0) + w.text.length;
    if (cur.length && len + add > maxChars) {
      lines.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(w);
    len += (cur.length > 1 ? 1 : 0) + w.text.length;
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function drawTitleOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  title: string,
  style: TitleStyle,
  width: number,
  height: number,
): void {
  if (!title) return;

  const rawWords = title.trim().split(/\s+/).filter(Boolean);
  const words: TitleWord[] = rawWords.map((t, i) => ({ text: t, tier: style.wordColors?.[i] ?? 0 }));
  const wordLines = wrapColoredWords(words, style.maxCharsPerLine);

  const lineHeight = style.fontSize * 1.3;
  const totalTextH = wordLines.length * lineHeight;
  const padX = style.padding * 1.2;
  const padY = style.padding * 0.6;
  const boxH = totalTextH + padY * 2;

  ctx.font = `bold ${style.fontSize}px ${fontStack(style.fontName)}`;
  const spaceW = ctx.measureText(' ').width;

  // Measure each line's pixel width (word widths + inter-word spaces).
  const lineWidths = wordLines.map((line) =>
    line.reduce((w, word, idx) => w + ctx.measureText(word.text).width + (idx > 0 ? spaceW : 0), 0),
  );
  const maxW = lineWidths.length ? Math.max(...lineWidths) : 0;
  const boxW = maxW + padX * 2;
  const boxX = (width - boxW) / 2;

  // Determine Y
  let boxY: number;
  if (typeof style.positionY === 'number') {
    boxY = (style.positionY / 100) * height - boxH / 2;
  } else if (style.position === 'center') {
    boxY = (height - boxH) / 2;
  } else if (style.position === 'bottom') {
    boxY = height - boxH - style.padding;
  } else {
    boxY = style.padding;
  }

  ctx.save();

  // Background (skip entirely when fully transparent — e.g. boxed/clean templates).
  if (style.bgOpacity > 0.001) {
    const { r, g, b } = hexToRgb(style.bgColor);
    ctx.fillStyle = `rgba(${r},${g},${b},${style.bgOpacity})`;
    roundRect(ctx, boxX, boxY, boxW, boxH, style.borderRadius);
    ctx.fill();
  }

  // Text — draw word by word so each word can carry its own color. Centered
  // per line by laying out from (center − lineWidth/2).
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const hl = style.highlightColor || '#FFD23F';
  const ac = style.accentColor || '#FF4D4D';
  // A subtle shadow keeps light title words legible on bright video when the
  // background box is transparent.
  if (style.bgOpacity <= 0.001) {
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = Math.max(4, style.fontSize * 0.12);
    ctx.shadowOffsetY = 2;
  }
  wordLines.forEach((line, li) => {
    let x = width / 2 - lineWidths[li] / 2;
    const y = boxY + padY + li * lineHeight;
    line.forEach((word, idx) => {
      if (idx > 0) x += spaceW;
      ctx.fillStyle = tierColor(word.tier, style.fontColor, hl, ac);
      ctx.fillText(word.text, x, y);
      x += ctx.measureText(word.text).width;
    });
  });
  ctx.restore();
}

// ─── Subtitle overlay ─────────────────────────────────────────────────────────

interface SubtitleStyle {
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  fontSize: number;
  fontName: string;
  bold: boolean;
  marginV: number;
  preset?: string;
}

function drawSubtitleOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  entries: SubtitleEntry[],
  currentTimeSec: number,
  clipStartSec: number,
  style: SubtitleStyle,
  width: number,
  _height: number,
): void {
  // Find active entry
  let activeEntry: SubtitleEntry | null = null;
  for (const entry of entries) {
    const start = timeToSec(entry.start) - clipStartSec;
    const end = timeToSec(entry.end) - clipStartSec;
    const relTime = currentTimeSec - clipStartSec;
    if (relTime >= start - 0.05 && relTime <= end + 0.05) {
      activeEntry = entry;
      break;
    }
  }
  if (!activeEntry) return;

  const entryStart = Math.max(timeToSec(activeEntry.start) - clipStartSec, 0);
  const entryEnd = Math.max(timeToSec(activeEntry.end) - clipStartSec, 0);
  const dur = entryEnd - entryStart;
  if (dur <= 0) return;

  const relTime = currentTimeSec - clipStartSec;
  const text = activeEntry.text.trim();
  const words = text.split(/\s+/);
  if (!words.length) return;

  // Per-word timing (proportional to character length)
  const totalChars = words.reduce((s, w) => s + Math.max(w.length, 1), 0);
  let t = entryStart;
  const wordSlots = words.map((w) => {
    const wDur = Math.max(0.04, (w.length / totalChars) * dur);
    const slot = { start: t, end: t + wDur };
    t += wDur;
    return slot;
  });

  let activeIdx = wordSlots.findIndex((s) => relTime >= s.start && relTime < s.end);
  if (activeIdx === -1 && relTime >= wordSlots[wordSlots.length - 1]?.start) {
    activeIdx = wordSlots.length - 1;
  }

  const preset = style.preset || 'karaoke';
  const fontWeight = style.bold ? 'bold' : 'normal';
  const baseFont = `${fontWeight} ${style.fontSize}px ${fontStack(style.fontName)}`;
  const popFont = `${fontWeight} ${Math.round(style.fontSize * 1.18)}px ${fontStack(style.fontName)}`;
  ctx.font = baseFont;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const upperWords = words.map((w) => w.toUpperCase());
  const spaceW = ctx.measureText(' ').width;
  const maxLineWidth = width * 0.9; // keep ~5% margin on each side

  // Greedy word-wrap so captions never run off the frame. Each item keeps its
  // global word index (gi) so the active-word styling maps correctly. The
  // active word in 'pop' is measured at its scaled size so layout stays exact.
  type Item = { text: string; gi: number; w: number };
  const fontFor = (gi: number) => (preset === 'pop' && gi === activeIdx ? popFont : baseFont);
  const measure = (wd: string, gi: number) => {
    ctx.font = fontFor(gi);
    const w = ctx.measureText(wd).width;
    ctx.font = baseFont;
    return w;
  };
  const lines: { items: Item[]; width: number }[] = [];
  let cur: Item[] = [];
  let curW = 0;
  upperWords.forEach((wd, gi) => {
    const w = measure(wd, gi);
    const add = cur.length ? spaceW + w : w;
    if (cur.length && curW + add > maxLineWidth) {
      lines.push({ items: cur, width: curW });
      cur = [{ text: wd, gi, w }];
      curW = w;
    } else {
      cur.push({ text: wd, gi, w });
      curW += add;
    }
  });
  if (cur.length) lines.push({ items: cur, width: curW });

  const lineHeight = style.fontSize * 1.3;
  const centerX = width / 2;
  const bottomBaseline = _height - style.marginV; // baseline of the last line

  ctx.lineWidth = style.outlineWidth * 2;
  ctx.strokeStyle = style.outlineColor;
  ctx.lineJoin = 'round';

  lines.forEach((line, li) => {
    const baseline = bottomBaseline - (lines.length - 1 - li) * lineHeight;
    const startX = centerX - line.width / 2;

    // 'minimal': dark bar behind the whole line, plain text, no outline.
    if (preset === 'minimal') {
      const pad = style.fontSize * 0.35;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, startX - pad, baseline - style.fontSize * 1.05, line.width + pad * 2, style.fontSize * 1.4, 8);
      ctx.fill();
      let x = startX;
      for (const it of line.items) {
        ctx.fillStyle = style.primaryColor;
        ctx.fillText(it.text, x, baseline);
        x += it.w + spaceW;
      }
      return;
    }

    // 'box': pill behind the active word (drawn before text passes).
    if (preset === 'box') {
      let x = startX;
      for (const it of line.items) {
        if (it.gi === activeIdx) {
          const pad = style.fontSize * 0.18;
          ctx.fillStyle = style.highlightColor;
          roundRect(ctx, x - pad, baseline - style.fontSize * 1.0, it.w + pad * 2, style.fontSize * 1.32, 6);
          ctx.fill();
        }
        x += it.w + spaceW;
      }
    }

    // Outline pass (whole line) — skipped for the boxed active word.
    let x = startX;
    for (const it of line.items) {
      ctx.font = fontFor(it.gi);
      if (!(preset === 'box' && it.gi === activeIdx)) {
        ctx.strokeText(it.text, x, baseline);
      }
      x += it.w + spaceW;
    }

    // Fill pass with per-preset active-word styling.
    x = startX;
    for (const it of line.items) {
      ctx.font = fontFor(it.gi);
      const isActive = it.gi === activeIdx;
      if (preset === 'box') {
        ctx.fillStyle = isActive ? '#FFFFFF' : style.primaryColor;
      } else {
        ctx.fillStyle = isActive ? style.highlightColor : style.primaryColor;
      }
      ctx.fillText(it.text, x, baseline);
      x += it.w + spaceW;
    }
    ctx.font = baseFont;
  });
}

// ─── Logo overlay ─────────────────────────────────────────────────────────────

function drawLogoOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  logoImg: ImageBitmap | HTMLImageElement,
  config: { x: number; y: number; size: number; opacity: number },
  width: number,
  height: number,
): void {
  // Match the Remotion LogoOverlay: width = size% of frame width, height keeps
  // the logo's natural aspect ratio, centered at (x%, y%).
  const naturalW = (logoImg as { width?: number }).width || 1;
  const naturalH = (logoImg as { height?: number }).height || 1;
  const drawW = (config.size / 100) * width;
  const drawH = drawW * (naturalH / naturalW);
  const drawX = (config.x / 100) * width - drawW / 2;
  const drawY = (config.y / 100) * height - drawH / 2;

  ctx.save();
  ctx.globalAlpha = config.opacity;
  ctx.drawImage(logoImg as CanvasImageSource, drawX, drawY, drawW, drawH);
  ctx.restore();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToSec(t: string): number {
  const clean = t.replace(',', '.').trim();
  const parts = clean.split(':');
  if (parts.length === 3) return +parts[0] * 3600 + +parts[1] * 60 + +parts[2];
  if (parts.length === 2) return +parts[0] * 60 + +parts[1];
  return 0;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
