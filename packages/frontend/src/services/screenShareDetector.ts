import type { FaceDetection, FaceDetector } from './faceTracker';

type FaceBox = NonNullable<FaceDetection['boundingBox']>;
interface Reports { best: FaceDetection; members: FaceDetection[] }

function confidence(detection: FaceDetection): number {
  const scores = detection.categories?.map((category) => category.score) ?? [];
  return scores.length > 0 && scores.every((score) => Number.isFinite(score) && score >= 0 && score <= 1)
    ? Math.max(...scores) : -1;
}

function validBox(box: FaceBox | undefined): box is FaceBox {
  return !!box && [box.originX, box.originY, box.width, box.height].every(Number.isFinite)
    && box.width > 0 && box.height > 0;
}

function copyDetection(detection: FaceDetection): FaceDetection {
  return { ...detection,
    boundingBox: detection.boundingBox ? { ...detection.boundingBox } : undefined,
    categories: detection.categories?.map((category) => ({ ...category })),
  };
}

/** Require both spatial overlap and nearly coincident centers; proximity alone
 * must not collapse a second face into the webcam speaker. */
function sameFace(a: FaceDetection, b: FaceDetection): boolean {
  const first = a.boundingBox, second = b.boundingBox;
  if (!validBox(first) || !validBox(second) || confidence(a) < 0 || confidence(b) < 0) return false;
  const overlap = Math.max(0, Math.min(first.originX + first.width, second.originX + second.width)
    - Math.max(first.originX, second.originX))
    * Math.max(0, Math.min(first.originY + first.height, second.originY + second.height)
      - Math.max(first.originY, second.originY));
  const firstArea = first.width * first.height, secondArea = second.width * second.height;
  const intersectionOverUnion = overlap / (firstArea + secondArea - overlap);
  const containment = overlap / Math.min(firstArea, secondArea);
  const dx = (first.originX + first.width / 2 - second.originX - second.width / 2)
    / Math.min(first.width, second.width);
  const dy = (first.originY + first.height / 2 - second.originY - second.height / 2)
    / Math.min(first.height, second.height);
  return Math.hypot(dx, dy) <= 0.3
    && (intersectionOverUnion >= 0.5 || (containment >= 0.85 && overlap / Math.max(firstArea, secondArea) >= 0.42));
}

/** Synchronous, opt-in small-face rescue. Coordinates stay in the full source
 * detection canvas; scores and the strongest real report are never averaged.
 * `source` must have the supplied width/height and must differ from `scratch`. */
export function detectScreenShareFaces(
  detector: FaceDetector, source: CanvasImageSource, width: number, height: number,
  scratch: HTMLCanvasElement, fullDetections: FaceDetection[],
): FaceDetection[] {
  if (source === scratch || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width < 2 || height < 2 || width > 1536 || height > 1536
    || width * height > 1_200_000 || !Array.isArray(fullDetections)) {
    throw new Error('Invalid screen-share detection canvas');
  }
  if (scratch.width !== width) scratch.width = width;
  if (scratch.height !== height) scratch.height = height;
  const context = scratch.getContext('2d');
  if (!context) throw new Error('Screen-share corner detection canvas is unavailable');

  const groups: Reports[] = [];
  const add = (detection: FaceDetection) => {
    // Complete-link matching prevents a chain of slightly shifted detections
    // from silently merging distinct faces. Multiple possible matches remain
    // ambiguous reports for the one-face policy to reject.
    const matches = groups.filter((group) => group.members.every((member) => sameFace(member, detection)));
    if (matches.length !== 1) {
      groups.push({ best: detection, members: [detection] });
      return;
    }
    const group = matches[0];
    group.members.push(detection);
    if (confidence(detection) > confidence(group.best)) group.best = detection;
  };
  // Keep malformed full reports as ambiguity; a missing/invalid tile report,
  // however, must not manufacture ambiguity or erase a reliable full report.
  fullDetections.forEach((detection) => add(copyDetection(detection)));
  const tileWidth = width / 2, tileHeight = height / 2;
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    const x = col * tileWidth, y = row * tileHeight;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, width, height);
    context.drawImage(source, x, y, tileWidth, tileHeight, 0, 0, width, height);
    const detections = detector.detect(scratch).detections;
    if (!Array.isArray(detections)) throw new Error('Invalid screen-share corner detections');
    for (const detection of detections) {
      const box = detection?.boundingBox;
      if (!detection || !validBox(box) || confidence(detection) < 0.4) continue;
      // Boxes on a tile border cannot establish that the entire face was
      // visible. Never clamp a clipped detection and pretend it is complete.
      const margin = Math.max(1, Math.min(box.width, box.height) * 0.03);
      if (box.originX < margin || box.originY < margin
        || box.originX + box.width > width - margin || box.originY + box.height > height - margin) continue;
      const mapped = copyDetection(detection);
      mapped.boundingBox = { originX: x + box.originX / 2, originY: y + box.originY / 2,
        width: box.width / 2, height: box.height / 2 };
      add(mapped);
    }
  }
  return groups.map((group) => group.best);
}
