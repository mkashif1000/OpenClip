import { subtitleStyleFromConfig } from '@viral-clipper/shared/rendering/subtitleConfig';
/**
 * Canvas 2D export renderer — shares overlay drawing and crop geometry with preview.
 * Handles: TitleOverlay, SubtitleOverlay, LogoOverlay, PIP layout.
 */

import type { ClipData, StyleConfig, PIPConfig } from '@/types';
import type { AutoSplitCrop, AutoSplitFrame } from './autoSplitPolicy';
import { drawTitleOverlay, drawSubtitleOverlay, drawLogoOverlay } from '@viral-clipper/shared/rendering/overlays';
import { titleStyleFromConfig } from '@viral-clipper/shared/rendering/titleConfig';
import { getSplitRegions, SPLIT_LAYOUTS, getBoxRect, getRegionRect, getPipRegions, roundRect, type LayoutType } from '@viral-clipper/shared/rendering/geometry';
export { getSplitRegions, SPLIT_LAYOUTS, type LayoutType } from '@viral-clipper/shared/rendering/geometry';

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
  /** Candidate verified against this exact decoded source frame, export only. */
  autoSplitFrame?: AutoSplitFrame | null;
  /** Extra zoom on the background video (Ken Burns for B-roll). 1 = none. */
  bgZoom?: number;
  /**
   * Per-region source crops (split / gameplay layouts). Same order as
   * getSplitRegions(layout); coords normalized [0,1] on the source. When
   * absent, defaults from getSplitRegions are used.
   */
  regionCrops?: Array<{ x: number; y: number; w: number; h: number }>;
  /**
   * Time window (seconds relative to clip start) during which a split layout
   * applies; outside it the frame is drawn standard/full-frame. Null = whole clip.
   */
  layoutRange?: { start: number; end: number } | null;
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
  const autoSplitSeam = layoutType === 'standard' && height > width
    ? drawAutoSplitLayout(ctx, video, job.autoSplitFrame, width, height, styleConfig.export) : null;

  if (autoSplitSeam !== null) {
    // The two verified crops have already filled the frame.
  } else if ((layoutType === 'hybrid') && relativeTime >= pipStartSec && relativeTime <= pipEndSec && pipConfig) {
    drawPIPLayout(ctx, video, pipConfig, width, height, faceCenter);
  } else if (layoutType === 'pip' && pipConfig) {
    drawPIPLayout(ctx, video, pipConfig, width, height, faceCenter);
  } else if (
    layoutType === 'pip' &&
    (!job.layoutRange || (relativeTime >= job.layoutRange.start && relativeTime <= job.layoutRange.end))
  ) {
    // PIP picked in the Edit tab's box editor (regionCrops, no legacy
    // pipConfig): render as a two-region split — big content on top,
    // smaller speaker box below.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    drawSplitLayout(ctx, video, 'pip', width, height, faceCenter, job.regionCrops);
  } else if (
    SPLIT_LAYOUTS.has(layoutType) &&
    (!job.layoutRange || (relativeTime >= job.layoutRange.start && relativeTime <= job.layoutRange.end))
  ) {
    // Multi-source split layouts: each region is a crop of the source drawn
    // at a sub-region of the output. Per-clip source crops (set in the
    // Layout Editor modal) override the auto defaults when present. When a
    // layoutRange is set, the split only shows inside that window — outside
    // it the clip falls through to the standard full-frame draw below.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    drawSplitLayout(ctx, video, layoutType, width, height, faceCenter, job.regionCrops);
  } else if (layoutType === 'boxed') {
    // Boxed: video sits in a centered rounded-corner inset on a black bg.
    // Used by the "Boxed Video" podcast template (title above, captions below).
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    drawBoxedLayout(ctx, video, width, height, faceCenter, styleConfig.export?.box_radius, {
      widthPct: styleConfig.export?.box_width,
      heightPct: styleConfig.export?.box_height,
      yPct: styleConfig.export?.box_y,
    });
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
    drawTitleOverlay(ctx, clip.title, titleStyleFromConfig(titleStyle, width, height, clip.edits?.titleColors), width, height);
  }

  // ─── Subtitle overlay ───────────────────────────────────────────────────────
  const subStyle = styleConfig.subtitle;
  const entries = clip.entries || [];
  if (entries.length > 0) {
    const captionStyle = subtitleStyleFromConfig(subStyle, width, height);
    if (autoSplitSeam !== null && styleConfig.export?.auto_split_center_captions === true) {
      // An ephemeral visual-center anchor, not a persisted last-line baseline.
      // Rebuilding the style every frame restores the user's normal position.
      captionStyle.visualCenterY = autoSplitSeam;
      captionStyle.positionX = 50;
      captionStyle.textAlign = 'center';
    }
    drawSubtitleOverlay(ctx, entries, currentTimeSec, clipStartSec, captionStyle, width, height);
  }
}

/** Reject uncertain timestamps/bounds before drawing either pane. Returns the
 * actual seam only after drawing. No DOM or VideoFrame global is needed. */
function drawAutoSplitLayout(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  video: VideoSourceLike,
  candidate: AutoSplitFrame | null | undefined,
  width: number,
  height: number,
  exportConfig: StyleConfig['export'],
): number | null {
  const timestamp = (video as VideoFrame).timestamp;
  if (!candidate || typeof (video as HTMLVideoElement).videoWidth === 'number'
    || typeof timestamp !== 'number' || !Number.isFinite(timestamp)
    || !Number.isFinite(candidate.sourceTimestampUs) || timestamp !== candidate.sourceTimestampUs
    || !Array.isArray(candidate.crops) || candidate.crops.length !== 2) return null;
  const { w: vw, h: vh } = sourceSize(video);
  if (![vw, vh, width, height].every((v) => Number.isFinite(v) && v > 0)) return null;
  const [a, b] = candidate.crops;
  if (!isAutoSplitCrop(a) || !isAutoSplitCrop(b)
    || (a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)) return null;

  if (candidate.kind === 'screen-share') {
    if (exportConfig?.auto_split_screen_share !== true
      || !Number.isFinite(candidate.splitRatio) || candidate.splitRatio !== 0.6) return null;
    const webcam = candidate.webcam;
    // Screen content must remain substantial, and the inset must really be a
    // bounded webcam region, never a full-frame second copy of the source.
    if (!isAutoSplitCrop(webcam) || webcam.w < 0.08 || webcam.h < 0.12
      || webcam.w > 0.5 || webcam.h > 0.65 || webcam.w * webcam.h < 0.012
      || webcam.w * webcam.h > 0.25 || a.w < 0.14 || a.h < 0.14 || a.w * a.h < 0.035
      || b.x < webcam.x || b.y < webcam.y
      || b.x + b.w > webcam.x + webcam.w || b.y + b.h > webcam.y + webcam.h
      || b.w < Math.max(0.04, webcam.w * 0.25)
      || b.h < Math.max(0.06, webcam.h * 0.25) || b.w * b.h < 0.008) return null;
    const coveredContent = Math.max(0, Math.min(a.x + a.w, webcam.x + webcam.w) - Math.max(a.x, webcam.x))
      * Math.max(0, Math.min(a.y + a.h, webcam.y + webcam.h) - Math.max(a.y, webcam.y));
    if (coveredContent > a.w * a.h * 0.35) return null;

    const seam = height * candidate.splitRatio;
    const cropW = a.w * vw, cropH = a.h * vh;
    // Contain the ENTIRE screen crop; cover-fitting here would cut off text.
    const scale = Math.min(width / cropW, seam / cropH);
    const fittedW = cropW * scale, fittedH = cropH * scale;
    const fittedX = (width - fittedW) / 2, fittedY = (seam - fittedH) / 2;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(video as CanvasImageSource, a.x * vw, a.y * vh, cropW, cropH,
      fittedX, fittedY, fittedW, fittedH);

    // Remove the original inset only where it intersects the contained screen.
    // Clip in destination space as well, so the mask cannot bleed into bars or
    // the lower speaker pane even at fractional-pixel boundaries.
    const left = Math.max(a.x, webcam.x), top = Math.max(a.y, webcam.y);
    const right = Math.min(a.x + a.w, webcam.x + webcam.w);
    const bottom = Math.min(a.y + a.h, webcam.y + webcam.h);
    if (right > left && bottom > top) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fittedX, fittedY, fittedW, fittedH);
      ctx.clip();
      ctx.fillRect(fittedX + (left - a.x) * vw * scale, fittedY + (top - a.y) * vh * scale,
        (right - left) * vw * scale, (bottom - top) * vh * scale);
      ctx.restore();
    }
    drawAutoSplitCover(ctx, video, b, vw, vh, 0, seam, width, height - seam);
    ctx.restore();
    return seam;
  }

  // Only the legacy missing discriminator means faces. An unknown mode or
  // screen-only metadata must not silently fall through to a face layout.
  if ((candidate.kind !== undefined && candidate.kind !== 'faces')
    || exportConfig?.auto_split_faces !== true || candidate.webcam !== undefined
    || (candidate.splitRatio !== undefined && candidate.splitRatio !== 0.5)) return null;

  const halfHeight = height / 2;
  for (let i = 0; i < 2; i++) {
    drawAutoSplitCover(ctx, video, candidate.crops[i], vw, vh, 0, i * halfHeight, width, halfHeight);
  }
  return halfHeight;
}

function isAutoSplitCrop(crop: AutoSplitCrop | null | undefined): crop is AutoSplitCrop {
  return !!crop && [crop.x, crop.y, crop.w, crop.h].every(Number.isFinite)
    && crop.x >= 0 && crop.y >= 0 && crop.w > 0 && crop.h > 0
    && crop.x + crop.w <= 1 && crop.y + crop.h <= 1;
}

function drawAutoSplitCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  video: VideoSourceLike,
  crop: AutoSplitCrop,
  vw: number, vh: number,
  x: number, y: number, width: number, height: number,
): void {
  const aspect = width / height;
  const cropW = crop.w * vw, cropH = crop.h * vh;
  // Cover-fit within each independent crop, never stretch or sample outside
  // the verified bounds (including tiny aspect differences from rounding).
  const sw = Math.min(cropW, cropH * aspect);
  const sh = Math.min(cropH, cropW / aspect);
  const sx = crop.x * vw + (cropW - sw) / 2;
  const sy = crop.y * vh + (cropH - sh) / 2;
  ctx.drawImage(video as CanvasImageSource, sx, sy, sw, sh, x, y, width, height);
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
  const [content, speaker] = getPipRegions(width, height, splitRatio);
  const contentHeight = content.h;
  const speakerHeight = speaker.h;

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
    const { x: dx, y: dy, w: dw, h: dh } = getRegionRect(region.out, width, height);
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
  geom?: { widthPct?: number; heightPct?: number; yPct?: number },
): void {
  const { x: boxX, y: boxY, w: boxW, h: boxH, radius } = getBoxRect(width, height, {
    widthPct: geom?.widthPct, heightPct: geom?.heightPct, yPct: geom?.yPct, radius: boxRadius,
  });

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
