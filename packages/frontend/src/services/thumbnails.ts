/**
 * Client-side clip thumbnails.
 *
 * Captures a single frame from the source video (stored in OPFS) at a given
 * time and returns a small JPEG object URL. Replaces the old server-rendered
 * /thumbnails endpoint — everything runs locally.
 *
 * Design notes:
 *  - One reused <video> element per source file (cheap repeated seeks vs. 15
 *    separate decoders on a multi-GB file).
 *  - All captures are serialized through a single queue so we never run many
 *    seeks/decodes in parallel.
 *  - Results are cached in-memory by (fileId, second, width) and de-duped while
 *    in flight.
 */

const cache = new Map<string, string>();             // key -> object URL
const pending = new Map<string, Promise<string>>();  // key -> in-flight promise
const videoEls = new Map<string, Promise<HTMLVideoElement>>(); // fileId -> <video>
let chain: Promise<unknown> = Promise.resolve();

/** Run tasks strictly one-at-a-time, regardless of prior success/failure. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function getVideoEl(fileId: string): Promise<HTMLVideoElement> {
  let p = videoEls.get(fileId);
  if (!p) {
    p = (async () => {
      const { opfsGetBlobUrl } = await import('./opfs');
      const url = await opfsGetBlobUrl(fileId);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.preload = 'auto';
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('video metadata timeout')), 20000);
        video.onloadedmetadata = () => { clearTimeout(to); resolve(); };
        video.onerror = () => { clearTimeout(to); reject(new Error('video load failed')); };
      });
      return video;
    })();
    videoEls.set(fileId, p);
    // If loading fails, drop the cached promise so a later call can retry.
    p.catch(() => videoEls.delete(fileId));
  }
  return p;
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const dur = video.duration && isFinite(video.duration) ? video.duration : t + 1;
    const clamped = Math.min(Math.max(t, 0), Math.max(dur - 0.1, 0));
    if (video.readyState >= 2 && Math.abs(video.currentTime - clamped) < 0.05) {
      resolve();
      return;
    }
    const cleanup = () => {
      clearTimeout(to);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('seek error')); };
    const to = setTimeout(() => { cleanup(); reject(new Error('seek timeout')); }, 15000);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = clamped;
  });
}

/**
 * Get a JPEG thumbnail (object URL) for a frame of the OPFS video at timeSec.
 * Safe to call many times — work is serialized, de-duped, and cached.
 */
export async function getClipThumbnail(
  fileId: string,
  timeSec: number,
  maxWidth = 320,
): Promise<string> {
  const key = `${fileId}:${Math.round(timeSec)}:${maxWidth}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const task = enqueue(async () => {
    const video = await getVideoEl(fileId);
    await seekTo(video, timeSec);

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.min(1, maxWidth / vw);
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.7));
    if (!blob) throw new Error('thumbnail encode failed');
    const url = URL.createObjectURL(blob);
    cache.set(key, url);
    return url;
  });

  pending.set(key, task);
  task.finally(() => pending.delete(key)).catch(() => {});
  return task;
}
