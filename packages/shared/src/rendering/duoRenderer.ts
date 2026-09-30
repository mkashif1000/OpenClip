import type { SubtitleStyle } from './overlays';
import { fontStack } from './fonts';
import { roundRect } from './geometry';

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Frame-time driven (no timers/randomness). Used by Remotion, cards and workers. */
export function drawDuoCaption(ctx: Context, words: string[], slots: { start: number; end: number }[],
  active: number, time: number, s: SubtitleStyle, width: number, height: number): void {
  ctx.save();
  try {
    const baseSize = clamp(s.fontSize || 48, 8, 240);
    const ratio = clamp(s.accent_scale ?? 1.5, 0.6, 2.5);
    const longest = words.reduce((best, w, i) => w.length >= words[best].length ? i : best, 0);
    const emphasis = (i: number) => s.duo_emphasis === 'last' ? i === words.length - 1
      : s.duo_emphasis === 'longest' ? i === longest : i % 2 === 1;
    const display = words.map(w => s.textCase === 'original' ? w : s.textCase === 'lower' ? w.toLowerCase() : w.toUpperCase());
    const spacing = s.letterSpacing ?? 0;
    const font = (i: number) => `${(emphasis(i) ? s.accent_italic : s.italic) ? 'italic ' : ''}${(emphasis(i) ? s.accent_bold !== false : s.bold) ? 'bold' : 'normal'} ${baseSize * (emphasis(i) ? ratio : 1)}px ${fontStack(emphasis(i) ? s.accent_font_name : s.fontName)}`;
    const measure = (text: string) => spacing === 0 ? ctx.measureText(text).width
      : [...text].reduce((n, ch) => n + ctx.measureText(ch).width, 0) + Math.max(0, [...text].length - 1) * spacing;
    const paint = (text: string, x: number, y: number, stroke = false) => {
      const glyph = (ch: string, at: number) => stroke ? ctx.strokeText(ch, at, y) : ctx.fillText(ch, at, y);
      if (!spacing) glyph(text, x);
      else for (const ch of text) { glyph(ch, x); x += ctx.measureText(ch).width + spacing; }
    };
    ctx.font = font(0);
    const gap = baseSize * 0.25 + Math.max(0, spacing);
    const maxWidth = width * clamp(s.maxWidthPct ?? 88, 10, 96) / 100;
    const sizes = display.map((w, i) => { ctx.font = font(i); return Math.max(1, measure(w)); });
    // Reserve effect space and fit unbroken long words before wrapping.
    const scale = Math.min(1, maxWidth / (Math.max(...sizes) * 1.18 + baseSize));
    const lineLimit = maxWidth / scale - baseSize * 0.7;
    const rows: { ids: number[]; width: number; size: number }[] = [];
    display.forEach((_, i) => {
      let row = rows[rows.length - 1];
      const size = baseSize * (emphasis(i) ? ratio : 1);
      const stackedBreak = s.duo_layout === 'stacked' && row && (emphasis(i) || emphasis(i - 1));
      if (!row || stackedBreak || row.width + gap + sizes[i] > lineLimit) {
        row = { ids: [], width: 0, size }; rows.push(row);
      }
      row.width += (row.ids.length ? gap : 0) + sizes[i];
      row.ids.push(i); row.size = Math.max(row.size, size);
    });
    const leading = clamp(s.lineHeight ?? 1.2, 1.05, 2);
    const totalHeight = rows.reduce((n, r) => n + r.size * leading, 0);
    const fit = Math.min(scale, height * 0.72 / Math.max(totalHeight, 1));
    const cx = clamp(width * (s.positionX ?? 50) / 100, maxWidth / 2, width - maxWidth / 2);
    const bottom = clamp(height - s.marginV, totalHeight * fit + baseSize * fit * 0.2, height - baseSize * fit * 0.3);
    let centerY = bottom - totalHeight * fit / 2;
    let localCenterY = 0;
    if (typeof s.visualCenterY === 'number' && Number.isFinite(s.visualCenterY)) {
      // Duo captions have variable row sizes, fitting and animated glyphs.
      // Measure their painted bounds in local coordinates rather than treating
      // marginV or the nominal line boxes as the visual center.
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      let inkTop = Infinity, inkBottom = -Infinity;
      let rowTop = -totalHeight / 2;
      for (const row of rows) {
        const baseline = rowTop + row.size;
        if ((s.bgOpacity ?? 0) > 0) {
          const pad = s.bgPadding ?? 10;
          inkTop = Math.min(inkTop, rowTop - pad / 2);
          inkBottom = Math.max(inkBottom, rowTop + row.size * 1.12 + pad / 2);
        }
        for (const i of row.ids) {
          const slot = slots[i];
          const p = clamp((time - slot.start) / Math.max(0.04, slot.end - slot.start), 0, 1);
          const on = active === i;
          const effect = s.duo_effect ?? 'rise';
          const eased = 1 - Math.pow(1 - clamp(p * 3, 0, 1), 3);
          const pulse = on ? Math.sin(p * Math.PI) : 0;
          const size = baseSize * (emphasis(i) ? ratio : 1);
          const zoom = on && effect === 'bounce' ? 1 + pulse * 0.12
            : on && effect === 'stamp' ? 1.15 - eased * 0.15 : 1;
          const dy = on && effect === 'rise' ? (1 - eased) * size * 0.22
            : on && effect === 'bounce' ? -pulse * size * 0.13 : 0;
          const angle = on && effect === 'stamp' ? (1 - eased) * -0.1 : 0;
          const include = (left: number, right: number, top: number, bottom: number) => {
            for (const x of [left, right]) for (const y of [top, bottom]) {
              const at = baseline - size * 0.4 + Math.sin(angle) * x * zoom
                + Math.cos(angle) * (y * zoom + dy);
              inkTop = Math.min(inkTop, at); inkBottom = Math.max(inkBottom, at);
            }
          };
          ctx.font = font(i);
          const text = effect === 'typewriter' ? (time < slot.start ? '' : display[i].slice(0, Math.ceil([...display[i]].length * (on ? eased : 1)))) : display[i];
          const left = -sizes[i] / 2, y = size * 0.4;
          if (text) {
            const m = ctx.measureText(text);
            const ascent = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : size * 0.8;
            const descent = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : size * 0.2;
            const outline = effect === 'outline' && !on ? Math.max(1, s.outlineWidth) / 2 : Math.max(0, s.outlineWidth);
            include(left - outline, left + measure(text) + outline, y - ascent - outline, y + descent + outline);
          }
          if (effect === 'marker' && on && eased > 0) {
            include(left - size * 0.06, left - size * 0.06 + (sizes[i] + size * 0.12) * eased, y - size, y + size * 0.18);
          }
          if (effect === 'underline' && on && eased > 0) {
            include(left, left + sizes[i] * eased, y + size * 0.12, y + size * 0.12 + Math.max(2, size * 0.06));
          }
        }
        rowTop += row.size * leading;
      }
      centerY = s.visualCenterY;
      if (Number.isFinite(inkTop) && Number.isFinite(inkBottom)) localCenterY = (inkTop + inkBottom) / 2;
    }
    ctx.translate(cx, centerY);
    ctx.rotate(clamp(s.rotation ?? 0, -30, 30) * Math.PI / 180);
    ctx.scale(fit, fit);
    if (localCenterY) ctx.translate(0, -localCenterY);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    let top = -totalHeight / 2;
    for (const row of rows) {
      const startX = s.textAlign === 'left' ? -lineLimit / 2
        : s.textAlign === 'right' ? lineLimit / 2 - row.width : -row.width / 2;
      const baseline = top + row.size;
      const pad = s.bgPadding ?? 10;
      if ((s.bgOpacity ?? 0) > 0) {
        ctx.save(); ctx.globalAlpha = clamp(s.bgOpacity ?? 0, 0, 1); ctx.fillStyle = s.bgColor ?? '#111111';
        roundRect(ctx, startX - pad, top - pad / 2, row.width + pad * 2, row.size * 1.12 + pad, s.bgRadius ?? 10);
        ctx.fill(); ctx.restore();
      }
      let x = startX;
      for (const i of row.ids) {
        const slot = slots[i];
        const p = clamp((time - slot.start) / Math.max(0.04, slot.end - slot.start), 0, 1);
        const on = active === i;
        const effect = s.duo_effect ?? 'rise';
        const eased = 1 - Math.pow(1 - clamp(p * 3, 0, 1), 3);
        const pulse = on ? Math.sin(p * Math.PI) : 0;
        const size = baseSize * (emphasis(i) ? ratio : 1);
        const color = emphasis(i) || on ? s.highlightColor : s.primaryColor;
        ctx.save();
        ctx.font = font(i);
        ctx.translate(x + sizes[i] / 2, baseline - size * 0.4);
        let zoom = 1, dy = 0, dx = 0;
        if (on && effect === 'rise') dy = (1 - eased) * size * 0.22;
        if (on && effect === 'slide') dx = -(1 - eased) * size * 0.35;
        if (on && effect === 'bounce') { zoom = 1 + pulse * 0.12; dy = -pulse * size * 0.13; }
        if (on && effect === 'stamp') { zoom = 1.15 - eased * 0.15; ctx.rotate((1 - eased) * -0.1); }
        ctx.translate(dx, dy); ctx.scale(zoom, zoom);
        const left = -sizes[i] / 2, y = size * 0.4;
        if (effect === 'marker' && on) {
          ctx.fillStyle = s.highlightColor;
          roundRect(ctx, left - size * 0.06, y - size, (sizes[i] + size * 0.12) * eased, size * 1.18, s.bgRadius ?? 4);
          ctx.fill();
        }
        if (effect === 'underline' && on) {
          ctx.fillStyle = s.highlightColor; ctx.fillRect(left, y + size * 0.12, sizes[i] * eased, Math.max(2, size * 0.06));
        }
        if (effect === 'echo' && on) {
          ctx.globalAlpha = 0.35 * pulse; ctx.fillStyle = s.highlightColor;
          paint(display[i], left - size * 0.09, y); ctx.fillStyle = s.shadowColor ?? '#FF479E';
          paint(display[i], left + size * 0.09, y); ctx.globalAlpha = 1;
        }
        ctx.shadowColor = s.shadowColor ?? '#000000';
        ctx.shadowBlur = (s.shadowBlur ?? 0) * (effect === 'glow' ? 0.6 + pulse : 1);
        ctx.shadowOffsetX = s.shadowX ?? 0; ctx.shadowOffsetY = s.shadowY ?? 0;
        ctx.strokeStyle = s.outlineColor; ctx.lineWidth = Math.max(0.5, s.outlineWidth * 2);
        ctx.fillStyle = effect === 'marker' && on ? s.activeTextColor ?? '#111111' : color;
        // Type-on preserves all measured positions; only painted glyphs change.
        const text = effect === 'typewriter' ? (time < slot.start ? '' : display[i].slice(0, Math.ceil([...display[i]].length * (on ? eased : 1)))) : display[i];
        if (effect === 'outline' && !on) { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, s.outlineWidth); paint(text, left, y, true); }
        else { if (s.outlineWidth > 0) paint(text, left, y, true); paint(text, left, y); }
        ctx.restore(); x += sizes[i] + gap;
      }
      top += row.size * leading;
    }
  } finally { ctx.restore(); }
}
