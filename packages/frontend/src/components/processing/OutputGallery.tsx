import { useState, useEffect } from 'react';
import { Download, Film, Play, X, ChevronLeft, ChevronRight, FolderArchive, Loader2 } from 'lucide-react';
import { useClipStore } from '@/stores/clipStore';
import { useProcessingStore } from '@/stores/processingStore';
import { downloadBlob, getClipFilename } from '@/services/renderService';
import { cn } from '@/lib/cn';
import type { ClipData } from '@/types';

export function OutputGallery() {
  const clips = useClipStore((s) => s.clips);
  const outputBlobs = useProcessingStore((s) => s.outputBlobs);
  const hydrateOutputs = useProcessingStore((s) => s.hydrateOutputs);
  const completed = clips.filter((c) => c.status === 'completed' && outputBlobs[c.clip_id]);
  const [playingClip, setPlayingClip] = useState<ClipData | null>(null);

  // Restore persisted outputs (OPFS) after a refresh or project switch.
  useEffect(() => {
    hydrateOutputs().catch(() => {});
  }, [clips, hydrateOutputs]);

  if (completed.length === 0) {
    return (
      <section className="rounded-2xl glass p-10 text-center animate-rise hairline-top">
        <div className="mx-auto mb-3 w-14 h-14 rounded-2xl glass flex items-center justify-center">
          <Film className="w-6 h-6 text-text-dim" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-text-muted">No rendered clips yet</p>
        <p className="text-xs text-text-dim mt-1">Process clips to see them here</p>
      </section>
    );
  }

  const playingIdx = playingClip ? completed.findIndex((c) => c.clip_id === playingClip.clip_id) : -1;

  return (
    <section className="rounded-2xl glass p-5 animate-rise hairline-top" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
            <Film className="w-4 h-4 text-text/90" strokeWidth={1.75} />
          </div>
          <h3 className="text-sm font-semibold text-text tracking-tight">Rendered Clips</h3>
          <span className="text-[10px] text-text-dim px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 font-mono">
            {completed.length} TOTAL
          </span>
        </div>
        {completed.length > 1 && <DownloadAllButton clips={completed} blobs={outputBlobs} />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {completed.map((clip, idx) => {
          const blob = outputBlobs[clip.clip_id];
          const url = blob ? URL.createObjectURL(blob) : '#';
          return (
            <div
              key={clip.clip_id}
              className="group rounded-xl glass-subtle overflow-hidden border border-white/8 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-pop animate-rise"
              style={{ animationDelay: `${220 + idx * 30}ms` }}
            >
              <div
                className="aspect-[9/16] bg-black flex items-center justify-center relative cursor-pointer"
                onClick={() => setPlayingClip(clip)}
              >
                <video
                  src={url}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                  onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                  onMouseLeave={(e) => {
                    const v = e.target as HTMLVideoElement;
                    v.pause();
                    v.currentTime = 0;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full glass-strong flex items-center justify-center">
                    <Play className="w-5 h-5 text-white" fill="currentColor" />
                  </div>
                </div>
                <div className="absolute top-1.5 right-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur text-white border border-white/15">
                  SCORE {clip.score}
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-xs text-text font-medium truncate">{clip.title || clip.output_file}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-text-dim font-mono">
                    {clip.duration.toFixed(0)}s · {blob ? (blob.size / (1024 * 1024)).toFixed(1) + ' MB' : ''}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); blob && downloadBlob(blob, getClipFilename(clip, clip.index)); }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-text hover:bg-white/8"
                    title="Download"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {playingClip && (
        <VideoPlayerModal
          clip={playingClip}
          blob={outputBlobs[playingClip.clip_id]}
          onClose={() => setPlayingClip(null)}
          onPrev={playingIdx > 0 ? () => setPlayingClip(completed[playingIdx - 1]) : undefined}
          onNext={playingIdx < completed.length - 1 ? () => setPlayingClip(completed[playingIdx + 1]) : undefined}
          currentIndex={playingIdx + 1}
          totalClips={completed.length}
        />
      )}
    </section>
  );
}

function DownloadAllButton({ clips, blobs }: { clips: ClipData[]; blobs: Record<string, Blob> }) {
  const [busy, setBusy] = useState(false);

  const handleDownloadAll = async () => {
    setBusy(true);
    try {
      const { createZip } = await import('@/services/zip');
      const entries = [];
      for (const clip of clips) {
        const blob = blobs[clip.clip_id];
        if (!blob) continue;
        entries.push({
          name: getClipFilename(clip, clip.index),
          data: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      if (entries.length) {
        downloadBlob(createZip(entries), 'openclip_clips.zip');
      }
    } catch (err) {
      console.error('ZIP download failed:', err);
    }
    setBusy(false);
  };

  return (
    <button
      onClick={handleDownloadAll}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-text border border-white/12 text-xs font-medium disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderArchive className="w-3.5 h-3.5" />}
      Download All (.ZIP)
    </button>
  );
}

function VideoPlayerModal({
  clip, blob, onClose, onPrev, onNext, currentIndex, totalClips,
}: {
  clip: ClipData; blob: Blob | undefined; onClose: () => void;
  onPrev?: () => void; onNext?: () => void;
  currentIndex: number; totalClips: number;
}) {
  const url = blob ? URL.createObjectURL(blob) : '#';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(8, 8, 10, 0.85)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}
    >
      <div className="relative max-w-sm w-full mx-4 animate-rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{clip.title || 'Untitled'}</h3>
            <p className="text-xs text-white/50 font-mono">
              {currentIndex} of {totalClips} · {clip.duration.toFixed(0)}s
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden bg-black aspect-[9/16] ring-1 ring-white/10">
          <video src={url} className="w-full h-full object-contain" controls autoPlay />
        </div>

        <div className="flex items-center justify-between mt-3">
          <button
            onClick={onPrev}
            disabled={!onPrev}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm',
              onPrev ? 'text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed',
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            onClick={() => blob && downloadBlob(blob, getClipFilename(clip, clip.index))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black hover:bg-accent-hover text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={onNext}
            disabled={!onNext}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm',
              onNext ? 'text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed',
            )}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
