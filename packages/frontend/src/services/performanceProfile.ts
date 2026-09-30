/**
 * Small, conservative capability profile used to keep the editor responsive on
 * older laptops and phones. It never removes a feature; it changes scheduling
 * and preview quality while final export settings remain user-controlled.
 */
export type PerformanceTier = 'high' | 'balanced' | 'low';

export interface PerformanceProfile {
  tier: PerformanceTier;
  cores: number;
  memoryGb: number | null;
  hasWebCodecs: boolean;
  hasWebGPU: boolean;
  maxConcurrentJobs: number;
  previewWidth: number;
  thumbnailWidth: number;
  faceSampleFps: number;
  encoderQueueLimit: number;
  shouldYieldEveryFrames: number;
}

let cached: PerformanceProfile | null = null;

export function getPerformanceProfile(): PerformanceProfile {
  if (cached) return cached;

  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
  const cores = Math.max(1, nav.hardwareConcurrency || 2);
  const memoryGb = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const hasWebCodecs = typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined';
  const hasWebGPU = !!nav.gpu;
  const lowSignals = cores <= 2 || (memoryGb != null && memoryGb <= 4);
  const highSignals = cores >= 8 && (memoryGb == null || memoryGb >= 8) && hasWebCodecs;
  const tier: PerformanceTier = lowSignals ? 'low' : highSignals ? 'high' : 'balanced';

  cached = {
    tier,
    cores,
    memoryGb,
    hasWebCodecs,
    hasWebGPU,
    maxConcurrentJobs: tier === 'high' ? 2 : 1,
    previewWidth: tier === 'low' ? 480 : tier === 'balanced' ? 720 : 960,
    thumbnailWidth: tier === 'low' ? 180 : tier === 'balanced' ? 240 : 320,
    faceSampleFps: tier === 'low' ? 1 : 2,
    encoderQueueLimit: tier === 'low' ? 8 : tier === 'balanced' ? 16 : 24,
    shouldYieldEveryFrames: tier === 'low' ? 2 : tier === 'balanced' ? 6 : 12,
  };
  return cached;
}

export function resetPerformanceProfile(): void {
  cached = null;
}

export async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}
