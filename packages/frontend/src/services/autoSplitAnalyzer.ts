import { getFaceDetector } from './faceTracker';
import { decodeClipFrames } from './mp4Decoder';
import { analyzeScreenShareFrame, isScreenShareContinuous, type ScreenShareFrameAnalysis } from './screenSharePolicy';
import { detectScreenShareFaces } from './screenShareDetector';
import {
  AUTO_SPLIT_POLICY, buildAutoSplitCrops, getAutoSplitRunWindow, isAutoSplitHardCut,
  isAutoSplitPairContinuous, isAutoSplitSourceContinuous, isAutoSplitSourceFrameFresh,
  selectAutoSplitFaces,
  type AutoSplitCrop, type AutoSplitFacePair, type AutoSplitFrame,
} from './autoSplitPolicy';

export interface AutoSplitAnalysisOptions {
  file: File;
  frameSrcTimes: Float64Array;
  fps: number;
  outputWidth: number;
  outputHeight: number;
  autoSplitFaces?: boolean;
  autoSplitScreenShare?: boolean;
  signal: AbortSignal;
  onProgress?: (done: number) => void;
}

interface FrameAnalysis {
  timestampUs: number;
  width: number;
  height: number;
  faces: AutoSplitFacePair | null;
  screenShare: ScreenShareFrameAnalysis | null;
  kind: 'faces' | 'screen-share' | null;
  crops: [AutoSplitCrop, AutoSplitCrop] | null;
  signature: Uint8ClampedArray;
}

/**
 * Independent, unsmoothed export pre-pass. Every output index is verified at
 * its exact edited source time using the same sample-selection decoder as the
 * renderer. Decode/detection failures invalidate the whole pass; never seek.
 */
export async function buildAutoSplitFrames(opts: AutoSplitAnalysisOptions): Promise<(AutoSplitFrame | null)[]> {
  const { file, frameSrcTimes, fps, outputWidth, outputHeight, signal, onProgress,
    autoSplitFaces = true, autoSplitScreenShare = false } = opts;
  signal.throwIfAborted();
  const frames: (AutoSplitFrame | null)[] = new Array(frameSrcTimes.length).fill(null);
  if ((!autoSplitFaces && !autoSplitScreenShare) || frames.length === 0 || !Number.isFinite(fps) || fps <= 0
    || !Number.isFinite(outputWidth) || !Number.isFinite(outputHeight)
    || outputWidth <= 0 || outputWidth >= outputHeight) return frames;
  // The decoder requires a monotonic time map. Do not guess at reordered or
  // malformed timelines and accidentally associate decisions with other frames.
  for (let i = 0; i < frameSrcTimes.length; i++) {
    if (!Number.isFinite(frameSrcTimes[i]) || frameSrcTimes[i] < 0
      || (i > 0 && frameSrcTimes[i] < frameSrcTimes[i - 1])) return frames;
  }

  let runStart = -1, runFirstTimestamp = 0, runLastTimestamp = 0;
  const finishRun = (end: number) => {
    if (runStart < 0) return;
    const window = getAutoSplitRunWindow(runStart, end, fps, runLastTimestamp - runFirstTimestamp);
    frames.fill(null, runStart, window?.start ?? end);
    if (window) frames.fill(null, window.end, end);
    runStart = -1;
  };

  try {
    const detector = await getFaceDetector();
    signal.throwIfAborted();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: autoSplitScreenShare });
    const screenShareCanvas = autoSplitScreenShare ? document.createElement('canvas') : null;
    const signatureCanvas = document.createElement('canvas');
    signatureCanvas.width = AUTO_SPLIT_POLICY.signatureWidth;
    signatureCanvas.height = AUTO_SPLIT_POLICY.signatureHeight;
    const signatureContext = signatureCanvas.getContext('2d', { willReadFrequently: true });
    if (!context || !signatureContext) return frames;

    // Cache only the same borrowed object on consecutive output indices. A
    // timestamp alone does not prove identical pixels (e.g. duplicate PTS).
    // WeakRef never retains the decoder-owned frame or its pixel resource.
    let cached: FrameAnalysis | null = null;
    let cachedSource: WeakRef<VideoFrame> | null = null;
    let previous: { requestedSec: number; analysis: FrameAnalysis } | null = null;
    let processed = 0;
    const analyze = (frame: VideoFrame): FrameAnalysis => {
      const width = Math.min(AUTO_SPLIT_POLICY.detectionWidth, frame.displayWidth);
      const height = Math.max(2, Math.round(frame.displayHeight * width / frame.displayWidth));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      context.drawImage(frame, 0, 0, width, height);
      const detections = detector.detect(canvas).detections;
      // The original full-frame detector alone decides two-face eligibility.
      // Screen-share may rescue small faces using four zoomed corner passes on
      // a separate canvas, without changing full-frame detections or pixels.
      const detectedFaces = autoSplitFaces ? selectAutoSplitFaces(detections, width, height) : null;
      const screenShare = autoSplitScreenShare ? analyzeScreenShareFrame({
        detections: detectScreenShareFaces(detector, canvas, width, height, screenShareCanvas!, detections),
        pixels: context.getImageData(0, 0, width, height).data, width, height,
        sourceWidth: frame.displayWidth, sourceHeight: frame.displayHeight, outputWidth, outputHeight,
      }) : null;
      const faces = screenShare ? null : detectedFaces;
      const crops = screenShare?.crops ?? (faces
        ? buildAutoSplitCrops(faces, frame.displayWidth, frame.displayHeight, outputWidth, outputHeight) : null);
      signatureContext.drawImage(frame, 0, 0, signatureCanvas.width, signatureCanvas.height);
      return {
        timestampUs: frame.timestamp, width: frame.displayWidth, height: frame.displayHeight, faces,
        screenShare, kind: screenShare ? 'screen-share' : crops ? 'faces' : null, crops,
        signature: signatureContext.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height).data,
      };
    };

    const decoded = await decodeClipFrames({
      file,
      startSec: frameSrcTimes[0],
      durationSec: frameSrcTimes[frameSrcTimes.length - 1] - frameSrcTimes[0] + 1 / fps,
      fps,
      signal,
      frameTimes: { at: (index) => frameSrcTimes[index], total: frameSrcTimes.length },
      onFrame: (frame, index) => {
        signal.throwIfAborted();
        if (index !== processed || index >= frames.length || !Number.isSafeInteger(frame.timestamp)
          || frame.displayWidth <= 0 || frame.displayHeight <= 0) {
          throw new Error('Auto split received an invalid decoded frame');
        }
        const requestedSec = frameSrcTimes[index];
        if (!isAutoSplitSourceFrameFresh(requestedSec, frame.timestamp)) {
          // Covers decoder tail-padding and unexpectedly stale source frames.
          finishRun(index);
          previous = null;
          cached = null;
          cachedSource = null;
          processed++;
          onProgress?.(processed);
          return;
        }
        const sourceContinuous = previous !== null && isAutoSplitSourceContinuous(
          previous.requestedSec, requestedSec, previous.analysis.timestampUs, frame.timestamp, fps,
        );
        const analysis = sourceContinuous && cachedSource?.deref() === frame && cached?.timestampUs === frame.timestamp
          && cached.width === frame.displayWidth && cached.height === frame.displayHeight
          ? cached : analyze(frame);
        if (previous && (!sourceContinuous
          || previous.analysis.width !== analysis.width || previous.analysis.height !== analysis.height
          || previous.analysis.kind !== analysis.kind
          || isAutoSplitHardCut(previous.analysis.signature, analysis.signature)
          || (previous.analysis.faces && analysis.faces
            && !isAutoSplitPairContinuous(previous.analysis.faces, analysis.faces))
          || (previous.analysis.screenShare && analysis.screenShare
            && !isScreenShareContinuous(previous.analysis.screenShare, analysis.screenShare)))) {
          finishRun(index);
        }
        if (analysis.kind && analysis.crops) {
          if (runStart < 0) {
            runStart = index;
            runFirstTimestamp = frame.timestamp;
          }
          // Use the actual borrowed VideoFrame timestamp, not the requested
          // grid time. The renderer must independently match this timestamp.
          frames[index] = analysis.screenShare
            ? { sourceTimestampUs: frame.timestamp, crops: analysis.crops, kind: 'screen-share',
              splitRatio: analysis.screenShare.splitRatio, webcam: analysis.screenShare.webcam }
            : { sourceTimestampUs: frame.timestamp, crops: analysis.crops };
          runLastTimestamp = frame.timestamp;
        } else {
          finishRun(index);
        }
        cached = analysis;
        cachedSource = typeof WeakRef === 'function' ? new WeakRef(frame) : null;
        previous = { requestedSec, analysis };
        processed++;
        onProgress?.(processed);
      },
    });
    signal.throwIfAborted();
    if (processed !== frames.length || decoded !== frames.length) throw new Error('Incomplete auto split analysis');
    finishRun(frames.length);
    return frames;
  } catch (error) {
    // Some decoder errors are wrapped, so the signal is authoritative even
    // when its custom abort reason is not an Error named AbortError.
    signal.throwIfAborted();
    if ((error as { name?: string } | null)?.name === 'AbortError') throw error;
    console.warn('Auto split analysis failed; using the regular layout:', error);
    return frames.fill(null);
  }
}
