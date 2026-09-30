import { renderFrame, type FrameRenderJob } from '../src/services/canvasRenderer';
import { ensureFontsLoaded } from '../src/services/fontLoader';

self.onmessage = async (event: MessageEvent<Omit<FrameRenderJob, 'canvas'>>) => {
  const job = event.data;
  try {
    await ensureFontsLoaded([job.styleConfig.title.font_name, job.styleConfig.subtitle.font_name]);
    const canvas = new OffscreenCanvas(job.width, job.height);
    renderFrame({ ...job, canvas });
    self.postMessage({ blob: await canvas.convertToBlob() });
  } catch (error) {
    self.postMessage({ error: String(error) });
  } finally {
    (job.video as ImageBitmap).close();
    (job.logoImg as ImageBitmap)?.close();
  }
};
