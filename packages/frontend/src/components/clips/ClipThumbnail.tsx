import { useEffect, useState } from 'react';
import { Film, Loader2 } from 'lucide-react';
import { getClipThumbnail } from '@/services/thumbnails';
import { cn } from '@/lib/cn';

interface ClipThumbnailProps {
  /** OPFS file id of the source video. */
  fileId?: string | null;
  /** Time (seconds) into the source video to capture. */
  timeSec: number;
  className?: string;
}

/**
 * Shows a locally-generated thumbnail for a clip (a frame captured from the
 * source video in OPFS). Renders a spinner while generating and a film icon if
 * generation fails or no video is available.
 */
export function ClipThumbnail({ fileId, timeSec, className }: ClipThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    if (!fileId) {
      setFailed(true);
      return;
    }
    getClipThumbnail(fileId, timeSec)
      .then((u) => { if (active) setUrl(u); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [fileId, timeSec]);

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded bg-panel border border-border flex items-center justify-center',
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : failed ? (
        <Film className="w-4 h-4 text-text-dim" />
      ) : (
        <Loader2 className="w-4 h-4 text-text-dim animate-spin" />
      )}
    </div>
  );
}
