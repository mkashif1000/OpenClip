import type { FaceDetection } from './faceTracker';
import { AUTO_SPLIT_POLICY, autoSplitRectsOverlap, type AutoSplitCrop, type AutoSplitFace } from './autoSplitPolicy';

export interface ScreenShareFrameInput {
  detections: FaceDetection[];
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
}

export interface ScreenShareFrameAnalysis {
  face: AutoSplitFace;
  webcam: AutoSplitCrop;
  crops: [AutoSplitCrop, AutoSplitCrop];
  splitRatio: number;
}

/** Pixel thresholds are deliberately fixed, independent of device speed. */
const POLICY = {
  splitRatio: 0.6,
  maxPixels: 1_200_000,
  maxDimension: 1536,
  edgeSamples: 48,
  edgeCandidates: 6,
  minEdgeContrast: 14,
  minEdgeSupport: 0.62,
  minExteriorFlat: 0.68,
  minExteriorNeutral: 0.7,
} as const;

interface Image {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  luma: Uint8Array;
  chroma: Uint8Array;
}
interface Rect { x: number; y: number; w: number; h: number }
interface Edge { position: number; score: number }
interface EdgeEvidence { support: number; flat: number; neutral: number; contrast: number; sharpness: number }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const area = (r: Rect) => r.w * r.h;
const positive = (n: number) => Number.isFinite(n) && n > 0;
const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const normalize = (r: Rect, image: Image): AutoSplitCrop => ({
  x: r.x / image.width, y: r.y / image.height, w: r.w / image.width, h: r.h / image.height,
});

function colorDifference(image: Image, a: number, b: number): number {
  const p = image.pixels;
  return Math.max(Math.abs(p[a * 4] - p[b * 4]), Math.abs(p[a * 4 + 1] - p[b * 4 + 1]),
    Math.abs(p[a * 4 + 2] - p[b * 4 + 2]));
}

function makeImage(input: ScreenShareFrameInput): Image | null {
  const { width, height, pixels, sourceWidth, sourceHeight, outputWidth, outputHeight } = input;
  if (![width, height, sourceWidth, sourceHeight, outputWidth, outputHeight].every(Number.isSafeInteger)
    || ![sourceWidth, sourceHeight, outputWidth, outputHeight].every(positive)
    || width < 96 || height < 64 || width > POLICY.maxDimension || height > POLICY.maxDimension
    || width * height > POLICY.maxPixels || outputWidth >= outputHeight
    || sourceWidth / sourceHeight < 1.15 || sourceWidth / sourceHeight > 3
    || Math.abs(height - sourceHeight * width / sourceWidth) > 1.5
    || !(pixels instanceof Uint8ClampedArray) || pixels.length !== width * height * 4) return null;
  const luma = new Uint8Array(width * height), chroma = new Uint8Array(width * height);
  for (let i = 0; i < luma.length; i++) {
    const j = i * 4, r = pixels[j], g = pixels[j + 1], b = pixels[j + 2];
    // A transparent/malformed read is not evidence of a black screen.
    if (pixels[j + 3] !== 255) return null;
    luma[i] = (r * 77 + g * 150 + b * 29) >> 8;
    chroma[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  return { pixels, width, height, luma, chroma };
}

function selectFace(detections: FaceDetection[], width: number, height: number): AutoSplitFace | null {
  // Do not discard a weak, tiny or duplicate second report to invent certainty.
  if (!Array.isArray(detections) || detections.length !== 1) return null;
  const detection = detections[0], box = detection?.boundingBox;
  const scores = detection?.categories?.map((category) => category.score) ?? [];
  if (!box || scores.length === 0 || scores.some((score) => !Number.isFinite(score) || score < 0 || score > 1)
    || ![box.originX, box.originY, box.width, box.height].every(Number.isFinite)) return null;
  const confidence = Math.max(...scores);
  if (confidence < AUTO_SPLIT_POLICY.minConfidence || box.width < 32 || box.height < 32
    || box.width / box.height < 0.55 || box.width / box.height > 1.65
    || box.originX < 0 || box.originY < 0 || box.originX + box.width > width
    || box.originY + box.height > height) return null;
  const face = { x: box.originX / width, y: box.originY / height,
    w: box.width / width, h: box.height / height, confidence };
  const c = center(face);
  if (face.w < 0.045 || face.h < 0.075 || face.w > 0.24 || face.h > 0.38 || area(face) < 0.005
    || (c.x > 0.38 && c.x < 0.62) || (c.y > 0.4 && c.y < 0.6)) return null;
  return face;
}

/** A seam must be straight, abrupt and have a largely flat, neutral exterior. */
function edgeEvidence(
  image: Image, vertical: boolean, position: number, from: number, to: number, inward: 1 | -1,
): EdgeEvidence {
  const limit = vertical ? image.width : image.height;
  let support = 0, flat = 0, neutral = 0, contrast = 0, sharpness = 0;
  const pixel = (cross: number, along: number) => vertical
    ? along * image.width + clamp(cross, 0, limit - 1)
    : clamp(cross, 0, limit - 1) * image.width + along;
  const inside = inward === 1 ? position : position - 1;
  const outside = inward === 1 ? position - 1 : position;
  for (let i = 0; i < POLICY.edgeSamples; i++) {
    const along = clamp(Math.floor(from + (to - from) * (i + 0.5) / POLICY.edgeSamples),
      0, (vertical ? image.height : image.width) - 1);
    const a = pixel(inside, along), b = pixel(outside, along);
    const inner = pixel(inside + inward, along), outer = pixel(outside - inward * 2, along);
    const jump = colorDifference(image, inner, outer), sharp = colorDifference(image, a, b);
    const exteriorVariation = colorDifference(image, b, outer);
    if (jump >= POLICY.minEdgeContrast && sharp >= Math.max(5, jump * 0.22)
      && exteriorVariation <= Math.max(10, jump * 0.3)) support++;
    if (exteriorVariation <= 12) flat++;
    if (image.chroma[b] <= 30 && image.chroma[outer] <= 30) neutral++;
    contrast += jump;
    sharpness += sharp;
  }
  const n = POLICY.edgeSamples;
  return { support: support / n, flat: flat / n, neutral: neutral / n,
    contrast: contrast / n, sharpness: sharpness / n };
}

function edgeScore(edge: EdgeEvidence): number {
  return edge.support * 0.45 + edge.flat * 0.15 + edge.neutral * 0.15
    + Math.min(1, edge.sharpness / 50) * 0.15 + Math.min(1, edge.contrast / 70) * 0.1;
}

function hasSeam(edge: EdgeEvidence): boolean {
  return edge.support >= POLICY.minEdgeSupport && edge.contrast >= 18
    && edge.flat >= POLICY.minExteriorFlat && edge.neutral >= POLICY.minExteriorNeutral;
}

function findEdges(
  image: Image, vertical: boolean, lo: number, hi: number, from: number, to: number, inward: 1 | -1,
): Edge[] {
  const limit = vertical ? image.width : image.height;
  const candidates: Edge[] = [];
  for (let position = Math.max(1, Math.ceil(lo)); position <= Math.min(limit - 1, Math.floor(hi)); position++) {
    const edge = edgeEvidence(image, vertical, position, from, to, inward);
    if (edge.support >= 0.55 && edge.contrast >= 16 && edge.flat >= 0.6 && edge.neutral >= 0.6) {
      candidates.push({ position, score: edgeScore(edge) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const result: Edge[] = [];
  for (const edge of candidates) {
    if (result.every((other) => Math.abs(other.position - edge.position) > 3)) result.push(edge);
    if (result.length === POLICY.edgeCandidates) break;
  }
  // A flush inset can use the frame boundary, but it is never pixel evidence.
  if (lo <= 0) result.push({ position: 0, score: 0.35 });
  if (hi >= limit) result.push({ position: limit, score: 0.35 });
  return result;
}

function photographicInterior(image: Image, rect: Rect): boolean {
  let sum = 0, square = 0, textured = 0, count = 0, variedCells = 0;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    let lo = 255, hi = 0;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const px = Math.min(image.width - 3, Math.floor(rect.x + rect.w * (col + (x + 0.5) / 5) / 4));
      const py = Math.min(image.height - 3, Math.floor(rect.y + rect.h * (row + (y + 0.5) / 5) / 3));
      const index = py * image.width + px, value = image.luma[index];
      sum += value; square += value * value; count++;
      lo = Math.min(lo, value); hi = Math.max(hi, value);
      if (Math.max(colorDifference(image, index, index + 2),
        colorDifference(image, index, index + image.width * 2)) >= 7) textured++;
    }
    if (hi - lo >= 18) variedCells++;
  }
  return square / count - (sum / count) ** 2 >= 15 ** 2 && textured / count >= 0.06 && variedCells >= 4;
}

function intersectionOverUnion(a: Rect, b: Rect): number {
  const overlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return overlap / (area(a) + area(b) - overlap);
}

function findWebcam(image: Image, face: AutoSplitFace): Rect | null {
  const { width: w, height: h } = image;
  const f = { x: face.x * w, y: face.y * h, w: face.w * w, h: face.h * h };
  const c = center(face), leftCorner = c.x < 0.5, topCorner = c.y < 0.5;
  // Search all four edges, including offset insets, rather than assuming that
  // the face's nearest screen edges are the camera's borders.
  const left = findEdges(image, true, leftCorner ? 0 : w * 0.38,
    Math.min(f.x - f.w * 0.15, leftCorner ? w * 0.16 : w), f.y, f.y + f.h, 1);
  const right = findEdges(image, true, Math.max(f.x + f.w * 1.15, leftCorner ? 0 : w * 0.84),
    leftCorner ? w * 0.62 : w, f.y, f.y + f.h, -1);
  const top = findEdges(image, false, topCorner ? 0 : h * 0.36,
    Math.min(f.y - f.h * 0.2, topCorner ? h * 0.16 : h), f.x, f.x + f.w, 1);
  const bottom = findEdges(image, false, Math.max(f.y + f.h * 1.16, topCorner ? 0 : h * 0.84),
    topCorner ? h * 0.64 : h, f.x, f.x + f.w, -1);
  const verified: Array<{ rect: Rect; score: number }> = [];
  for (const l of left) for (const r of right) for (const t of top) for (const b of bottom) {
    const rect = { x: l.position, y: t.position, w: r.position - l.position, h: b.position - t.position };
    const normalized = normalize(rect, image), aspect = rect.w / rect.h;
    if (normalized.w < 0.14 || normalized.w > 0.46 || normalized.h < 0.16 || normalized.h > 0.48
      || area(normalized) < 0.026 || area(normalized) > 0.21 || aspect < 0.8 || aspect > 2.5
      || f.w / rect.w < 0.16 || f.w / rect.w > 0.68 || f.h / rect.h < 0.25 || f.h / rect.h > 0.76) continue;
    const sides = [
      l.position === 0 ? null : edgeEvidence(image, true, l.position, t.position + 1, b.position - 1, 1),
      r.position === w ? null : edgeEvidence(image, true, r.position, t.position + 1, b.position - 1, -1),
      t.position === 0 ? null : edgeEvidence(image, false, t.position, l.position + 1, r.position - 1, 1),
      b.position === h ? null : edgeEvidence(image, false, b.position, l.position + 1, r.position - 1, -1),
    ];
    if (sides.filter(Boolean).length < 2 || sides.some((side) => side && !hasSeam(side))) continue;
    if (!photographicInterior(image, rect)) continue;
    verified.push({ rect, score: sides.reduce((sum, side) => sum + (side ? edgeScore(side) : 0.35), 0) / 4 });
  }
  verified.sort((a, b) => b.score - a.score);
  const best = verified[0];
  if (!best || verified.some((other) => other.score >= best.score - 0.08
    && intersectionOverUnion(best.rect, other.rect) < 0.8)) return null;
  return best.rect;
}

/** Repeated short, thin ink runs on flat neutral surfaces, in either polarity. */
function hasText(image: Image, rect: Rect, minimumTokens = 24): boolean {
  const x0 = Math.max(2, Math.ceil(rect.x)), x1 = Math.min(image.width - 2, Math.floor(rect.x + rect.w));
  const y0 = Math.max(4, Math.ceil(rect.y)), y1 = Math.min(image.height - 4, Math.floor(rect.y + rect.h));
  if (x1 - x0 < 36 || y1 - y0 < 20) return false;
  const yStep = Math.max(1, Math.floor((y1 - y0) / 72));
  const maxRun = clamp(Math.round((y1 - y0) * 0.1), 4, 14);
  const verticalProbe = clamp(Math.round((y1 - y0) * 0.035), 2, 4);
  let samples = 0, neutral = 0, flatBackground = 0, tokens = 0, rows = 0;
  let minX = x1, maxX = x0, minY = y1, maxY = y0;
  for (let y = y0; y < y1; y += yStep) {
    let rowTokens = 0;
    for (let x = x0; x < x1 - 2; x++) {
      const index = y * image.width + x, value = image.luma[index];
      samples++;
      if (image.chroma[index] > 35) continue;
      neutral++;
      const light = value >= 170, dark = value <= 65;
      if ((!light && !dark) || Math.abs(value - image.luma[index + 1]) > 10) continue;
      flatBackground++;
      const ink = (at: number) => image.chroma[at] <= 45
        && (light ? image.luma[at] <= 125 : image.luma[at] >= 140);
      const start = x + 2;
      if (!ink(y * image.width + start)) continue;
      let end = start + 1;
      while (end < x1 - 1 && end - start <= maxRun && ink(y * image.width + end)) end++;
      if (end - start > maxRun) continue;
      const after = y * image.width + end;
      if (image.chroma[after] > 35 || Math.abs(image.luma[after] - value) > 30) continue;
      const mid = y * image.width + Math.floor((start + end - 1) / 2);
      // Thin strokes return to the same background vertically; large photo
      // regions and window borders cannot supply all the text evidence.
      if (Math.min(Math.abs(image.luma[mid - verticalProbe * image.width] - value),
        Math.abs(image.luma[mid + verticalProbe * image.width] - value)) > 35) continue;
      tokens++; rowTokens++;
      minX = Math.min(minX, start); maxX = Math.max(maxX, end);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      x = end - 1;
    }
    if (rowTokens >= 2) rows++;
  }
  return samples > 0 && neutral / samples >= 0.72 && flatBackground / samples >= 0.32
    && tokens >= minimumTokens && rows >= 5 && maxX - minX >= rect.w * 0.28 && maxY - minY >= rect.h * 0.2;
}

function outsideText(image: Image, webcam: Rect): boolean {
  let count = 0;
  const rows = new Set<number>(), columns = new Set<number>();
  for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
    const rect = { x: col * image.width / 6, y: image.height * (0.17 + row * 0.185),
      w: image.width / 6, h: image.height * 0.185 };
    if (autoSplitRectsOverlap(rect, webcam) || !hasText(image, rect, 16)) continue;
    count++; rows.add(row); columns.add(col);
  }
  // Browser chrome, one logo or a ticker by itself is not shared content.
  return count >= 3 && rows.size >= 2 && columns.size >= 2;
}

/** Only a bright page with four independently visible dark exterior edges can
 * become a tight content crop. General slides/desktops retain the whole source. */
function pageEdge(
  image: Image, vertical: boolean, approximate: number, from: number, to: number, inward: 1 | -1, radius: number,
): number | null {
  const limit = vertical ? image.width : image.height;
  let best: { position: number; score: number } | null = null;
  for (let position = Math.max(3, Math.floor(approximate - radius));
    position <= Math.min(limit - 3, Math.ceil(approximate + radius)); position++) {
    const inside = inward === 1 ? position : position - 1;
    const outside = inward === 1 ? position - 1 : position;
    let supported = 0, flat = 0, contrast = 0;
    for (let i = 0; i < POLICY.edgeSamples; i++) {
      const along = clamp(Math.floor(from + (to - from) * (i + 0.5) / POLICY.edgeSamples),
        0, (vertical ? image.height : image.width) - 1);
      const at = (cross: number) => vertical ? along * image.width + cross : cross * image.width + along;
      const a = at(inside), b = at(inside + inward), c = at(outside), d = at(outside - inward * 2);
      const lightIndex = image.luma[a] >= image.luma[b] ? a : b;
      const inner = image.luma[lightIndex], outer = Math.max(image.luma[c], image.luma[d]);
      if (inner >= 170 && outer <= 145 && inner - outer >= 45
        && image.chroma[lightIndex] <= 35 && image.chroma[c] <= 35) supported++;
      if (colorDifference(image, c, d) <= 14) flat++;
      contrast += inner - outer;
    }
    const support = supported / POLICY.edgeSamples, exteriorFlat = flat / POLICY.edgeSamples;
    const meanContrast = contrast / POLICY.edgeSamples;
    if (support < 0.72 || exteriorFlat < 0.75 || meanContrast < 50) continue;
    const score = support + exteriorFlat * 0.25 + meanContrast / 510;
    if (!best || score > best.score) best = { position, score };
  }
  return best?.position ?? null;
}

function findDocuments(image: Image, webcam: Rect): Rect[] {
  const { width, height } = image;
  // Bounded connected-component search; the fine pixels are used again to
  // verify exact edges and text. This never treats a white blob alone as a page.
  const step = Math.max(2, Math.ceil(Math.max(width, height) / 256));
  const columns = Math.ceil(width / step), rows = Math.ceil(height / step);
  const map = new Uint8Array(columns * rows), queue = new Int32Array(map.length);
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const x = Math.min(width - 1, col * step + Math.floor(step / 2));
    const y = Math.min(height - 1, row * step + Math.floor(step / 2));
    const index = y * width + x;
    if (x >= webcam.x - 2 && x <= webcam.x + webcam.w + 2
      && y >= webcam.y - 2 && y <= webcam.y + webcam.h + 2) continue;
    if (image.luma[index] >= 160 && image.chroma[index] <= 35) map[row * columns + col] = 1;
  }
  // Join paper around fine print and thin newspaper rules. Closing is only a
  // proposal operation: original pixels still have to prove every page edge.
  const expanded = new Uint8Array(map.length);
  for (let row = 1; row < rows - 1; row++) for (let col = 1; col < columns - 1; col++) {
    const index = row * columns + col;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (map[index + dy * columns + dx]) expanded[index] = 1;
    }
  }
  map.fill(0);
  for (let row = 1; row < rows - 1; row++) for (let col = 1; col < columns - 1; col++) {
    const index = row * columns + col;
    let solid = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!expanded[index + dy * columns + dx]) solid = false;
    }
    if (solid) map[index] = 1;
  }
  const proposals: Rect[] = [];
  for (let seed = 0; seed < map.length; seed++) {
    if (!map[seed]) continue;
    map[seed] = 0; queue[0] = seed;
    let head = 0, tail = 1, minCol = columns, maxCol = 0, minRow = rows, maxRow = 0;
    while (head < tail) {
      const index = queue[head++], row = Math.floor(index / columns), col = index % columns;
      minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
      const visit = (neighbor: number) => {
        if (map[neighbor]) { map[neighbor] = 0; queue[tail++] = neighbor; }
      };
      if (col > 0) visit(index - 1);
      if (col < columns - 1) visit(index + 1);
      if (row > 0) visit(index - columns);
      if (row < rows - 1) visit(index + columns);
    }
    const rect = { x: minCol * step, y: minRow * step,
      w: Math.min(width, (maxCol + 1) * step) - minCol * step,
      h: Math.min(height, (maxRow + 1) * step) - minRow * step };
    const normalized = normalize(rect, image), c = center(normalized);
    if (normalized.w < 0.15 || normalized.h < 0.15 || area(normalized) < 0.035
      || area(normalized) > 0.65 || rect.w / rect.h < 0.45 || rect.w / rect.h > 3.5
      || c.x < 0.23 || c.x > 0.77 || c.y < 0.23 || c.y > 0.77
      || tail * step * step / area(rect) < 0.32 || autoSplitRectsOverlap(rect, webcam)) continue;
    proposals.push(rect);
  }
  proposals.sort((a, b) => area(b) - area(a));
  const documents: Rect[] = [];
  for (const rect of proposals.slice(0, 12)) {
    const radius = step * 2 + 1;
    const left = pageEdge(image, true, rect.x, rect.y + step, rect.y + rect.h - step, 1, radius);
    const right = pageEdge(image, true, rect.x + rect.w, rect.y + step, rect.y + rect.h - step, -1, radius);
    const top = pageEdge(image, false, rect.y, rect.x + step, rect.x + rect.w - step, 1, radius);
    const bottom = pageEdge(image, false, rect.y + rect.h, rect.x + step, rect.x + rect.w - step, -1, radius);
    if (left === null || right === null || top === null || bottom === null) continue;
    const page = { x: left, y: top, w: right - left, h: bottom - top };
    if (page.w <= 0 || page.h <= 0 || autoSplitRectsOverlap(page, webcam) || !hasText(image, page)) continue;
    if (documents.every((other) => intersectionOverUnion(page, other) < 0.8)) documents.push(page);
  }
  return documents;
}

function isolatedDocument(image: Image, page: Rect, webcam: Rect): boolean {
  let count = 0, bright = 0, darkNeutral = 0;
  const step = Math.max(2, Math.ceil(image.width / 192));
  const inside = (x: number, y: number, rect: Rect) => x >= rect.x - step && x <= rect.x + rect.w + step
    && y >= rect.y - step && y <= rect.y + rect.h + step;
  // Ignore the outer chrome/logo bands, but never discard another useful page,
  // slide or appreciable content elsewhere in the main screen body.
  for (let y = Math.ceil(image.height * 0.17); y < image.height * 0.92; y += step) {
    for (let x = Math.ceil(image.width * 0.03); x < image.width * 0.97; x += step) {
      if (inside(x, y, page) || inside(x, y, webcam)) continue;
      const i = y * image.width + x;
      count++;
      if (image.luma[i] > 95) bright++;
      if (image.luma[i] <= 65 && image.chroma[i] <= 30) darkNeutral++;
    }
  }
  return count > 0 && bright / count <= 0.025 && darkNeutral / count >= 0.94;
}

function speakerCrop(
  face: AutoSplitFace, webcam: AutoSplitCrop, input: ScreenShareFrameInput,
): AutoSplitCrop | null {
  const aspect = (input.outputWidth / (input.outputHeight * (1 - POLICY.splitRatio)))
    / (input.sourceWidth / input.sourceHeight);
  if (!positive(aspect)) return null;
  const maxHeight = Math.min(webcam.h, webcam.w / aspect);
  // Use the largest pane-shaped crop within the inset rather than zooming in
  // from the face box: detector boxes omit hair, so extra zoom can cut heads.
  const h = maxHeight, w = h * aspect;
  const c = center(face);
  const crop = { x: clamp(c.x - w / 2, webcam.x, webcam.x + webcam.w - w),
    y: clamp(c.y - h * 0.43, webcam.y, webcam.y + webcam.h - h), w, h };
  const comfortable = { x: face.x - face.w * 0.18, y: face.y - face.h * 0.2,
    w: face.w * 1.36, h: face.h * 1.36 };
  if (comfortable.x < crop.x || comfortable.y < crop.y || comfortable.x + comfortable.w > crop.x + crop.w
    || comfortable.y + comfortable.h > crop.y + crop.h) return null;
  return crop;
}

/** One exact image only: a corner face is merely a search seed, never proof. */
export function analyzeScreenShareFrame(input: ScreenShareFrameInput): ScreenShareFrameAnalysis | null {
  const face = selectFace(input.detections, input.width, input.height);
  if (!face) return null;
  const image = makeImage(input);
  if (!image) return null;
  const rect = findWebcam(image, face);
  if (!rect) return null;
  const webcam = normalize(rect, image), speaker = speakerCrop(face, webcam, input);
  if (!speaker) return null;
  const documents = findDocuments(image, rect);
  if (documents.length === 0 && !outsideText(image, rect)) return null;
  let content: AutoSplitCrop = { x: 0, y: 0, w: 1, h: 1 };
  if (documents.length === 1 && isolatedDocument(image, documents[0], rect)) {
    const page = documents[0];
    // Include the entire verified page, its border and a small sampling guard.
    const x = Math.max(0, page.x - 2), y = Math.max(0, page.y - 2);
    content = normalize({ x, y, w: Math.min(image.width, page.x + page.w + 2) - x,
      h: Math.min(image.height, page.y + page.h + 2) - y }, image);
  }
  return { face, webcam, crops: [content, speaker], splitRatio: POLICY.splitRatio };
}

/** Discontinuous inset/content geometry ends a sustained run just like a cut. */
export function isScreenShareContinuous(previous: ScreenShareFrameAnalysis, current: ScreenShareFrameAnalysis): boolean {
  const a = center(previous.face), b = center(current.face);
  const scale = (x: number, y: number) => Math.max(x, y) / Math.min(x, y);
  if (Math.hypot(a.x - b.x, a.y - b.y) > AUTO_SPLIT_POLICY.maxCenterStep
    || Math.abs(a.x - b.x) > Math.min(previous.face.w, current.face.w) * 0.6
    || Math.abs(a.y - b.y) > Math.min(previous.face.h, current.face.h) * 0.5
    || scale(previous.face.w, current.face.w) > AUTO_SPLIT_POLICY.maxScaleStep
    || scale(previous.face.h, current.face.h) > AUTO_SPLIT_POLICY.maxScaleStep) return false;
  const before = previous.webcam, after = current.webcam;
  if (Math.abs(before.x - after.x) > Math.max(0.005, Math.min(before.w, after.w) * 0.04)
    || Math.abs(before.y - after.y) > Math.max(0.005, Math.min(before.h, after.h) * 0.04)
    || scale(before.w, after.w) > 1.08 || scale(before.h, after.h) > 1.08) return false;
  const oldContent = previous.crops[0], newContent = current.crops[0];
  return Math.hypot(center(oldContent).x - center(newContent).x, center(oldContent).y - center(newContent).y) <= 0.025
    && scale(oldContent.w, newContent.w) <= 1.18 && scale(oldContent.h, newContent.h) <= 1.18;
}
