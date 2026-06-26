/**
 * Computes the ACTUAL output dimensions a render will produce, mirroring the
 * logic in processingStore. The live preview must use these exact dimensions
 * (not the 720×1280 placeholders) so absolute font sizes / positions look the
 * same in the preview as in the export — otherwise a Match-Source render at
 * 1080×1920 makes captions appear smaller than the 720-wide preview did.
 */

import type { ExportSettings } from '@/types';

export function computeOutputDims(
  exp: ExportSettings,
  srcW?: number | null,
  srcH?: number | null,
): { width: number; height: number } {
  const fmt = exp.format || 'match_source';
  const vertical = fmt !== 'horizontal';
  let w = exp.width || (vertical ? 720 : 1280);
  let h = exp.height || (vertical ? 1280 : 720);

  if (fmt === 'match_source' && srcW && srcH) {
    if (vertical) {
      h = Math.min(srcH, 1920);
      w = Math.min(Math.round((h * 9) / 16), srcW);
    } else {
      w = Math.min(srcW, 1920);
      h = Math.min(srcH, 1080);
    }
  }
  // H.264 needs even dimensions.
  return { width: w - (w % 2), height: h - (h % 2) };
}
