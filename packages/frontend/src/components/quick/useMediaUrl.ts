import { useEffect, useState } from 'react';
import { opfsGetBlobUrl } from '@/services/opfs';

/** Own each preview URL; stale reads and unmounts always release their blobs. */
export function useMediaUrl(fileId?: string) {
  const [result, setResult] = useState<{ id?: string; url?: string; error?: string }>({});
  useEffect(() => {
    if (!fileId) { setResult({}); return; }
    let disposed = false;
    let url: string | undefined;
    void opfsGetBlobUrl(fileId).then((value) => {
      url = value;
      if (disposed) URL.revokeObjectURL(value);
      else setResult({ id: fileId, url: value });
    }).catch(() => {
      if (!disposed) setResult({ id: fileId, error: 'This media file is unavailable. Re-import it to preview and export.' });
    });
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [fileId]);
  return result.id === fileId ? result : {};
}
