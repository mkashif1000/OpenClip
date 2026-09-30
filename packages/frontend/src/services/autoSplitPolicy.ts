import type { FaceDetection } from './faceTracker';

export interface AutoSplitCrop { x: number; y: number; w: number; h: number }

/** One decision for one actual decoded source frame, never an interpolated track. */
export interface AutoSplitFrame {
  sourceTimestampUs: number;
  crops: [AutoSplitCrop, AutoSplitCrop];
  /** Missing kind is the original two-face layout. */
  kind?: 'faces' | 'screen-share';
  splitRatio?: number;
  webcam?: AutoSplitCrop;
}

export interface AutoSplitFace extends AutoSplitCrop { confidence: number }
export type AutoSplitFacePair = [AutoSplitFace, AutoSplitFace];

/** Fixed precision on every device; performance profiles must not relax these. */
export const AUTO_SPLIT_POLICY = {
  detectionWidth: 768,
  minConfidence: 0.85,
  minFaceWidth: 0.07,
  minFaceHeight: 0.12,
  minFaceArea: 0.012,
  minFacePixels: 40,
  minPairAreaRatio: 0.4,
  minHorizontalSeparation: 0.18,
  maxVerticalSeparation: 0.24,
  maxCenterStep: 0.075,
  maxScaleStep: 1.3,
  minRunSeconds: 0.45,
  boundaryGuardSeconds: 0.06,
  maxSourceFrameAgeSeconds: 0.1,
  signatureWidth: 32,
  signatureHeight: 18,
  cutMeanDifference: 0.085,
  cutChangedPixelFraction: 0.45,
  cutPixelDifference: 0.12,
} as const;

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;
const center = (face: AutoSplitCrop) => ({ x: face.x + face.w / 2, y: face.y + face.h / 2 });
const area = (face: AutoSplitCrop) => face.w * face.h;
const scaleRatio = (a: number, b: number) => Math.max(a, b) / Math.min(a, b);
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

export function autoSplitRectsOverlap(a: AutoSplitCrop, b: AutoSplitCrop): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * The shared detector reports down to .4. Even a weak/tiny third report makes
 * this frame ambiguous: do not silently discard it and select the best two.
 */
export function selectAutoSplitFaces(
  detections: readonly FaceDetection[], width: number, height: number,
): AutoSplitFacePair | null {
  if (!finitePositive(width) || !finitePositive(height) || detections.length !== 2) return null;
  const faces: AutoSplitFace[] = [];
  for (const detection of detections) {
    const box = detection.boundingBox;
    const scores = detection.categories?.map((category) => category.score) ?? [];
    if (!box || scores.length === 0 || scores.some((score) => !Number.isFinite(score))) return null;
    const confidence = Math.max(...scores);
    if (confidence < AUTO_SPLIT_POLICY.minConfidence || confidence > 1) return null;
    if (![box.originX, box.originY, box.width, box.height].every(Number.isFinite)) return null;
    // Clipped boxes do not prove that the full face can be framed comfortably.
    if (box.originX < 0 || box.originY < 0 || box.originX + box.width > width
      || box.originY + box.height > height) return null;
    const face = { x: box.originX / width, y: box.originY / height,
      w: box.width / width, h: box.height / height, confidence };
    if (box.width < AUTO_SPLIT_POLICY.minFacePixels || box.height < AUTO_SPLIT_POLICY.minFacePixels
      || face.w < AUTO_SPLIT_POLICY.minFaceWidth || face.h < AUTO_SPLIT_POLICY.minFaceHeight
      || area(face) < AUTO_SPLIT_POLICY.minFaceArea) return null;
    // BlazeFace boxes are approximately square in pixel space. Extreme boxes
    // are unreliable detections, not a reason to invent a usable crop.
    if (box.width / box.height < 0.55 || box.width / box.height > 1.65) return null;
    faces.push(face);
  }
  faces.sort((a, b) => center(a).x - center(b).x);
  const [left, right] = faces;
  const a = center(left), b = center(right);
  if (autoSplitRectsOverlap(left, right)
    || Math.min(area(left), area(right)) / Math.max(area(left), area(right)) < AUTO_SPLIT_POLICY.minPairAreaRatio
    || b.x - a.x < Math.max(AUTO_SPLIT_POLICY.minHorizontalSeparation, (left.w + right.w) * 0.8)
    || Math.abs(b.y - a.y) > AUTO_SPLIT_POLICY.maxVerticalSeparation) return null;
  return [left, right];
}

function expandFace(face: AutoSplitCrop, amount: number): AutoSplitCrop {
  return { x: face.x - face.w * amount, y: face.y - face.h * amount,
    w: face.w * (1 + amount * 2), h: face.h * (1 + amount * 2) };
}

/** Each crop has the pixel aspect of one full-width, half-height output pane. */
export function buildAutoSplitCrops(
  faces: AutoSplitFacePair, sourceWidth: number, sourceHeight: number,
  outputWidth: number, outputHeight: number,
): [AutoSplitCrop, AutoSplitCrop] | null {
  if (![sourceWidth, sourceHeight, outputWidth, outputHeight].every(finitePositive)
    || outputWidth >= outputHeight) return null;
  const normalizedAspect = (outputWidth / (outputHeight / 2)) / (sourceWidth / sourceHeight);
  if (!finitePositive(normalizedAspect) || faces.some((face) =>
    ![face.x, face.y, face.w, face.h].every(Number.isFinite) || face.w <= 0 || face.h <= 0
    || face.x < 0 || face.y < 0 || face.x + face.w > 1 || face.y + face.h > 1)) return null;
  const crops: AutoSplitCrop[] = [];
  for (let index = 0; index < 2; index++) {
    const face = faces[index], other = faces[1 - index];
    const c = center(face);
    // Head plus shoulders, with eyes above the pane center; never zoom in just
    // to squeeze the other person out of an otherwise unsuitable composition.
    const h = Math.max(face.h * 2.8, face.w * 2.4 / normalizedAspect);
    const w = h * normalizedAspect;
    if (h > 1 || w > 1) return null;
    const crop = { x: clamp(c.x - w / 2, 0, 1 - w), y: clamp(c.y - h * 0.4, 0, 1 - h), w, h };
    const comfortableFace = expandFace(face, 0.4);
    if (comfortableFace.x < crop.x || comfortableFace.y < crop.y
      || comfortableFace.x + comfortableFace.w > crop.x + crop.w
      || comfortableFace.y + comfortableFace.h > crop.y + crop.h
      || autoSplitRectsOverlap(crop, expandFace(other, 0.2))) return null;
    crops.push(crop);
  }
  return [crops[0], crops[1]];
}

/** No identity reassignment across crossings or large camera/subject jumps. */
export function isAutoSplitPairContinuous(previous: AutoSplitFacePair, current: AutoSplitFacePair): boolean {
  for (let index = 0; index < 2; index++) {
    const before = previous[index], after = current[index];
    const a = center(before), b = center(after);
    const ownDistance = Math.hypot(b.x - a.x, b.y - a.y);
    const other = center(current[1 - index]);
    const otherDistance = Math.hypot(other.x - a.x, other.y - a.y);
    if (!Number.isFinite(ownDistance) || !Number.isFinite(otherDistance)
      || ownDistance > AUTO_SPLIT_POLICY.maxCenterStep
      || Math.abs(b.x - a.x) > Math.min(before.w, after.w) * 0.6
      || Math.abs(b.y - a.y) > Math.min(before.h, after.h) * 0.5
      || ownDistance + 0.025 >= otherDistance
      || scaleRatio(before.w, after.w) > AUTO_SPLIT_POLICY.maxScaleStep
      || scaleRatio(before.h, after.h) > AUTO_SPLIT_POLICY.maxScaleStep) return false;
  }
  return true;
}

export function isAutoSplitSourceFrameFresh(requestedSec: number, timestampUs: number): boolean {
  if (!Number.isFinite(requestedSec) || !Number.isFinite(timestampUs)) return false;
  const age = requestedSec - timestampUs / 1e6;
  // Match the decoder's 100us sample-selection tolerance.
  return age >= -0.000101 && age <= AUTO_SPLIT_POLICY.maxSourceFrameAgeSeconds;
}

/** Both the edited time map AND decoded timestamps must remain contiguous. */
export function isAutoSplitSourceContinuous(
  previousRequestedSec: number, requestedSec: number,
  previousTimestampUs: number, timestampUs: number, fps: number,
): boolean {
  if (!finitePositive(fps) || !isAutoSplitSourceFrameFresh(previousRequestedSec, previousTimestampUs)
    || !isAutoSplitSourceFrameFresh(requestedSec, timestampUs)) return false;
  const requestedStep = requestedSec - previousRequestedSec;
  const decodedStep = (timestampUs - previousTimestampUs) / 1e6;
  return Math.abs(requestedStep - 1 / fps) <= 0.00001
    && decodedStep >= 0 && decodedStep <= Math.max(2 / fps, AUTO_SPLIT_POLICY.maxSourceFrameAgeSeconds) + 0.0001;
}

/** A small RGB image, not a histogram: identical palettes can still be cuts. */
export function isAutoSplitHardCut(previous: ArrayLike<number>, current: ArrayLike<number>): boolean {
  if (previous.length === 0 || previous.length !== current.length || previous.length % 4 !== 0) return true;
  let difference = 0, changed = 0;
  const pixels = current.length / 4;
  for (let i = 0; i < current.length; i += 4) {
    const pixelDifference = (Math.abs(current[i] - previous[i])
      + Math.abs(current[i + 1] - previous[i + 1]) + Math.abs(current[i + 2] - previous[i + 2])) / (3 * 255);
    if (!Number.isFinite(pixelDifference)) return true;
    difference += pixelDifference;
    if (pixelDifference >= AUTO_SPLIT_POLICY.cutPixelDifference) changed++;
  }
  return difference / pixels >= AUTO_SPLIT_POLICY.cutMeanDifference
    && changed / pixels >= AUTO_SPLIT_POLICY.cutChangedPixelFraction;
}

/**
 * End is exclusive. This only removes decisions: it cannot fill a missed
 * frame, extend a run, or interpolate split activation across a boundary.
 */
export function getAutoSplitRunWindow(
  start: number, end: number, fps: number, sourceSpanUs: number,
): { start: number; end: number } | null {
  if (!finitePositive(fps) || !Number.isInteger(start) || !Number.isInteger(end) || start < 0
    || !Number.isFinite(sourceSpanUs) || sourceSpanUs < AUTO_SPLIT_POLICY.minRunSeconds * 0.75 * 1e6
    || end - start < Math.max(3, Math.ceil(AUTO_SPLIT_POLICY.minRunSeconds * fps))) return null;
  const guard = Math.max(1, Math.ceil(AUTO_SPLIT_POLICY.boundaryGuardSeconds * fps));
  return end - start - guard * 2 >= 2 ? { start: start + guard, end: end - guard } : null;
}
