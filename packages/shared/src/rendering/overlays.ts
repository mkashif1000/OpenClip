import type { SubtitleEntry } from '../types/index';
import { fontStack } from './fonts';
import { roundRect } from './geometry';
import type { DuoCaptionConfig } from './duoConfig';
import { drawDuoCaption } from './duoRenderer';

/** Defaults depend on the output aspect ratio, never its pixel width. */
export function resolveTitleStyle(style: Partial<TitleStyle>, width: number, height: number): TitleStyle {
  return {
    ...style,
    fontSize: style.fontSize ?? (height >= width ? 32 : 22),
    fontName: style.fontName || 'Inter',
    fontColor: style.fontColor ?? '#FFFFFF', bgColor: style.bgColor ?? '#000000',
    bgOpacity: style.bgOpacity ?? 0.75, padding: style.padding ?? 20,
    position: style.position ?? 'top', borderRadius: style.borderRadius ?? 6,
    maxCharsPerLine: style.maxCharsPerLine ?? (height >= width ? 25 : 45),
  };
}

export function resolveSubtitleStyle(style: Partial<SubtitleStyle>, width: number, height: number): SubtitleStyle {
  return {
    ...style,
    primaryColor: style.primaryColor ?? '#FFFFFF', highlightColor: style.highlightColor ?? '#FFFF00',
    outlineColor: style.outlineColor ?? '#000000', outlineWidth: style.outlineWidth ?? 4,
    fontSize: style.fontSize ?? (height >= width ? 62 : 36), fontName: style.fontName || 'Arial',
    bold: style.bold ?? true, marginV: style.marginV ?? (height >= width ? 120 : 60),
    maxWidthPct: style.maxWidthPct ?? 90, preset: style.preset ?? 'karaoke',
  };
}

// ─── Title overlay ────────────────────────────────────────────────────────────

export interface TitleStyle {
  enabled?: boolean;
  bold?: boolean;
  italic?: boolean;
  textCase?: 'upper' | 'lower' | 'original';
  letterSpacing?: number;
  lineHeight?: number;
  positionX?: number;
  rotation?: number;
  textAlign?: 'left' | 'center' | 'right';
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  fontSize: number;
  fontColor: string;
  bgColor: string;
  bgOpacity: number;
  padding: number;
  position: 'top' | 'center' | 'bottom';
  positionY?: number | null;
  borderRadius: number;
  maxCharsPerLine: number;
  /** Max title width as a % of frame width. When set, wrap by width. */
  maxWidthPct?: number;
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

/** Greedy word-wrap by measured pixel width. `ctx.font` is the title font. */
function wrapColoredWordsByWidth(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  words: TitleWord[],
  maxWidth: number,
  spaceW: number,
  measure = (text: string) => ctx.measureText(text).width,
): TitleWord[][] {
  const lines: TitleWord[][] = [];
  let cur: TitleWord[] = [];
  let curW = 0;
  for (const w of words) {
    const wordW = measure(w.text);
    const add = cur.length ? spaceW + wordW : wordW;
    if (cur.length && curW + add > maxWidth) {
      lines.push(cur);
      cur = [w];
      curW = wordW;
    } else {
      cur.push(w);
      curW += add;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export function drawTitleOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  title: string,
  style: TitleStyle,
  width: number,
  height: number,
): void {
  if (!title || style.enabled === false) return;

  const displayTitle = style.textCase === 'upper' ? title.toUpperCase() : style.textCase === 'lower' ? title.toLowerCase() : title;
  const rawWords = displayTitle.trim().split(/\s+/).filter(Boolean);
  const words: TitleWord[] = rawWords.map((t, i) => ({ text: t, tier: style.wordColors?.[i] ?? 0 }));

  ctx.font = `${style.italic ? 'italic ' : ''}${style.bold === false ? 'normal' : 'bold'} ${style.fontSize}px ${fontStack(style.fontName)}`;
  const spacing = style.letterSpacing ?? 0;
  const measure = (text: string) => spacing === 0 ? ctx.measureText(text).width
    : [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + Math.max(0, [...text].length - 1) * spacing;
  const paint = (text: string, x: number, y: number, stroke = false) => {
    const glyph = (text: string, at: number) => stroke ? ctx.strokeText(text, at, y) : ctx.fillText(text, at, y);
    if (!spacing) glyph(text, x);
    else for (const ch of text) { glyph(ch, x); x += ctx.measureText(ch).width + spacing; }
  };
  const spaceW = ctx.measureText(' ').width + spacing;

  // Wrap within the padded background box, or use the legacy character limit.
  const wordLines = typeof style.maxWidthPct === 'number'
    ? wrapColoredWordsByWidth(ctx, words, width * (style.maxWidthPct / 100) - style.padding * 2.4, spaceW, measure)
    : wrapColoredWords(words, style.maxCharsPerLine);

  const lineHeight = style.fontSize * (style.lineHeight ?? 1.3);
  const totalTextH = wordLines.length * lineHeight;
  const padX = style.padding * 1.2;
  const padY = style.padding * 0.6;
  const boxH = totalTextH + padY * 2;

  // Measure each line's pixel width (word widths + inter-word spaces).
  const lineWidths = wordLines.map((line) =>
    line.reduce((w, word, idx) => w + measure(word.text) + (idx > 0 ? spaceW : 0), 0),
  );
  const maxW = lineWidths.length ? Math.max(...lineWidths) : 0;
  const boxW = maxW + padX * 2;
  const centerX = width * (style.positionX ?? 50) / 100;
  const boxX = centerX - boxW / 2;

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

  ctx.translate(centerX, boxY + boxH / 2);
  ctx.rotate((style.rotation ?? 0) * Math.PI / 180);
  ctx.translate(-centerX, -boxY - boxH / 2);

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
  ctx.shadowColor = style.shadowColor ?? 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = style.shadowBlur ?? (style.bgOpacity <= 0.001 ? Math.max(4, style.fontSize * 0.12) : 0);
  ctx.shadowOffsetX = style.shadowX ?? 0;
  ctx.shadowOffsetY = style.shadowY ?? (style.bgOpacity <= 0.001 ? 2 : 0);
  ctx.strokeStyle = style.outlineColor ?? '#000000';
  ctx.lineWidth = Math.max(0.01, (style.outlineWidth ?? 0) * 2);
  ctx.lineJoin = 'round';
  wordLines.forEach((line, li) => {
    let x = style.textAlign === 'left' ? boxX + padX
      : style.textAlign === 'right' ? boxX + boxW - padX - lineWidths[li] : centerX - lineWidths[li] / 2;
    const y = boxY + padY + li * lineHeight;
    line.forEach((word, idx) => {
      if (idx > 0) x += spaceW;
      ctx.fillStyle = tierColor(word.tier, style.fontColor, hl, ac);
      if ((style.outlineWidth ?? 0) > 0) paint(word.text, x, y, true);
      paint(word.text, x, y);
      x += measure(word.text);
    });
  });
  ctx.restore();
}

// ─── Subtitle overlay ─────────────────────────────────────────────────────────

export interface SubtitleStyle extends DuoCaptionConfig {
  enabled?: boolean;
  italic?: boolean;
  textCase?: 'upper' | 'lower' | 'original';
  letterSpacing?: number;
  lineHeight?: number;
  positionX?: number;
  rotation?: number;
  textAlign?: 'left' | 'center' | 'right';
  bgColor?: string;
  bgOpacity?: number;
  bgPadding?: number;
  bgRadius?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  activeTextColor?: string;
  primaryColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineWidth: number;
  fontSize: number;
  fontName: string;
  bold: boolean;
  marginV: number;
  /** Internal, per-frame visual-center anchor in pixels; never persisted. */
  visualCenterY?: number;
  /** Max caption width as a % of frame width (controls wrapping). */
  maxWidthPct?: number;
  preset?: string;
}

export function drawSubtitleOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  entries: SubtitleEntry[],
  currentTimeSec: number,
  clipStartSec: number,
  style: SubtitleStyle,
  width: number,
  _height: number,
): void {
  if (style.enabled === false) return;
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
  const words = text.split(/\s+/).filter(Boolean);
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

  if (style.accent_font_name) {
    drawDuoCaption(ctx, words, wordSlots, activeIdx, relTime, style, width, _height);
    return;
  }

  const preset = style.preset || 'karaoke';
  const fontWeight = style.bold ? 'bold' : 'normal';
  const baseFont = `${style.italic ? 'italic ' : ''}${fontWeight} ${style.fontSize}px ${fontStack(style.fontName)}`;
  const popFont = `${style.italic ? 'italic ' : ''}${fontWeight} ${Math.round(style.fontSize * 1.18)}px ${fontStack(style.fontName)}`;
  ctx.font = baseFont;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const spacing = style.letterSpacing ?? 0;
  const measureText = (text: string) => spacing === 0 ? ctx.measureText(text).width
    : [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + Math.max(0, [...text].length - 1) * spacing;
  const paintText = (text: string, x: number, y: number, stroke = false) => {
    ctx.save();
    ctx.shadowColor = style.shadowColor ?? '#000000';
    ctx.shadowBlur = style.shadowBlur ?? 0;
    ctx.shadowOffsetX = style.shadowX ?? 0;
    ctx.shadowOffsetY = style.shadowY ?? 0;
    const paint = (t: string, at: number) => stroke ? ctx.strokeText(t, at, y) : ctx.fillText(t, at, y);
    if (spacing === 0) paint(text, x);
    else for (const ch of text) { paint(ch, x); x += ctx.measureText(ch).width + spacing; }
    ctx.restore();
  };
  const upperWords = words.map((w) => style.textCase === 'original' ? w : style.textCase === 'lower' ? w.toLowerCase() : w.toUpperCase());
  const spaceW = measureText(' ') + spacing;
  const maxLineWidth = width * ((style.maxWidthPct ?? 90) / 100);

  // Greedy word-wrap so captions never run off the frame. Each item keeps its
  // global word index (gi) so the active-word styling maps correctly. The
  // active word in 'pop' is measured at its scaled size so layout stays exact.
  type Item = { text: string; gi: number; w: number };
  const fontFor = (gi: number) => (preset === 'pop' && gi === activeIdx ? popFont : baseFont);
  const measure = (wd: string, gi: number) => {
    ctx.font = fontFor(gi);
    const w = measureText(wd);
    ctx.font = baseFont;
    return w;
  };
  const lines: { items: Item[]; width: number }[] = [];
  let cur: Item[] = [];
  let curW = 0;
  upperWords.forEach((wd, gi) => {
    if (preset === 'word' && gi !== Math.max(0, activeIdx)) return;
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

  const lineHeight = style.fontSize * (style.lineHeight ?? 1.3);
  const centerX = width * (style.positionX ?? 50) / 100;
  let bottomBaseline = _height - style.marginV; // baseline of the last line
  const anchored = typeof style.visualCenterY === 'number' && Number.isFinite(style.visualCenterY);
  if (anchored) {
    // Center the painted multi-line block, including mixed pop sizes and its
    // backgrounds. marginV alone specifies the final baseline, not its center.
    let inkTop = Infinity;
    let inkBottom = -Infinity;
    lines.forEach((line, li) => {
      const baseline = -(lines.length - 1 - li) * lineHeight;
      for (const it of line.items) {
        ctx.font = fontFor(it.gi);
        const metrics = ctx.measureText(it.text);
        const size = preset === 'pop' && it.gi === activeIdx ? Math.round(style.fontSize * 1.18) : style.fontSize;
        const ascent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : size * 0.8;
        const descent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : size * 0.2;
        const outline = preset !== 'minimal' && !(preset === 'box' && it.gi === activeIdx) ? Math.max(0, style.outlineWidth) : 0;
        inkTop = Math.min(inkTop, baseline - ascent - outline);
        inkBottom = Math.max(inkBottom, baseline + descent + outline);
        if (preset === 'box' && it.gi === activeIdx) {
          inkTop = Math.min(inkTop, baseline - style.fontSize);
          inkBottom = Math.max(inkBottom, baseline + style.fontSize * 0.32);
        }
      }
      if ((style.bgOpacity ?? (preset === 'minimal' ? 0.55 : 0)) > 0) {
        const pad = style.bgPadding ?? style.fontSize * 0.35;
        inkTop = Math.min(inkTop, baseline - style.fontSize - pad / 2);
        inkBottom = Math.max(inkBottom, baseline + style.fontSize * 0.15 + pad / 2);
      }
    });
    ctx.font = baseFont;
    if (Number.isFinite(inkTop) && Number.isFinite(inkBottom)) {
      bottomBaseline = style.visualCenterY! - (inkTop + inkBottom) / 2;
    }
  }

  ctx.save();
  const centerY = anchored ? style.visualCenterY! : bottomBaseline - (lines.length - 1) * lineHeight / 2 - style.fontSize / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate((style.rotation ?? 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);
  ctx.lineWidth = Math.max(0.01, style.outlineWidth * 2);
  ctx.strokeStyle = style.outlineColor;
  ctx.lineJoin = 'round';

  lines.forEach((line, li) => {
    const baseline = bottomBaseline - (lines.length - 1 - li) * lineHeight;
    const startX = style.textAlign === 'left' ? centerX - maxLineWidth / 2
      : style.textAlign === 'right' ? centerX + maxLineWidth / 2 - line.width : centerX - line.width / 2;

    const bgOpacity = style.bgOpacity ?? (preset === 'minimal' ? 0.55 : 0);
    if (bgOpacity > 0) {
      const pad = style.bgPadding ?? style.fontSize * 0.35;
      const { r, g, b } = hexToRgb(style.bgColor ?? '#000000');
      ctx.fillStyle = `rgba(${r},${g},${b},${bgOpacity})`;
      roundRect(ctx, startX - pad, baseline - style.fontSize - pad / 2,
        line.width + pad * 2, style.fontSize * 1.15 + pad, style.bgRadius ?? 8);
      ctx.fill();
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
      if (preset !== 'minimal' && style.outlineWidth > 0 && !(preset === 'box' && it.gi === activeIdx)) {
        paintText(it.text, x, baseline, true);
      }
      x += it.w + spaceW;
    }

    // Fill pass with per-preset active-word styling.
    x = startX;
    for (const it of line.items) {
      ctx.font = fontFor(it.gi);
      const isActive = it.gi === activeIdx;
      if (preset === 'box') {
        ctx.fillStyle = isActive ? (style.activeTextColor ?? '#FFFFFF') : style.primaryColor;
      } else {
        ctx.fillStyle = isActive && preset !== 'minimal' && preset !== 'plain' ? style.highlightColor : style.primaryColor;
      }
      paintText(it.text, x, baseline);
      x += it.w + spaceW;
    }
    ctx.font = baseFont;
  });
  ctx.restore();
}

// ─── Logo overlay ─────────────────────────────────────────────────────────────

export function drawLogoOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  logoImg: ImageBitmap | HTMLImageElement,
  config: { x: number; y: number; size: number; opacity: number },
  width: number,
  height: number,
): void {
  // Match the Remotion LogoOverlay: width = size% of frame width, height keeps
  // the logo's natural aspect ratio, centered at (x%, y%).
  const naturalW = (logoImg as HTMLImageElement).naturalWidth || logoImg.width || 1;
  const naturalH = (logoImg as HTMLImageElement).naturalHeight || logoImg.height || 1;
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


function tierColor(tier: number, base: string, highlight: string, accent: string): string {
  return tier === 1 ? highlight : tier === 2 ? accent : base;
}
