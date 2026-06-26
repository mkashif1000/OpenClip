import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, Maximize } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useClipStore } from '@/stores/clipStore';
import { opfsGetBlobUrl } from '@/services/opfs';


function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const project = useProjectStore((s) => s.currentProject);
  const { videoTime, videoDuration, videoPlaying, setVideoTime, setVideoDuration, setVideoPlaying } = useUIStore();
  const clips = useClipStore((s) => s.clips);

  // The source video lives in OPFS (local browser storage). Resolve it to a
  // revocable blob: URL for the <video> element — no server involved.
  const videoFileId = project?.video_file?.file_id ?? null;
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!videoFileId) {
      setVideoSrc(null);
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        url = await opfsGetBlobUrl(videoFileId);
        if (cancelled) URL.revokeObjectURL(url);
        else setVideoSrc(url);
      } catch {
        if (!cancelled) setVideoSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [videoFileId]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => setVideoTime(vid.currentTime);
    const onDuration = () => setVideoDuration(vid.duration || 0);
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('loadedmetadata', onDuration);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('loadedmetadata', onDuration);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
    };
  }, [setVideoTime, setVideoDuration, setVideoPlaying]);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play();
    else vid.pause();
  }, []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vid = videoRef.current;
    if (vid) vid.currentTime = Number(e.target.value);
  }, []);

  const toggleMute = useCallback(() => {
    const vid = videoRef.current;
    if (vid) vid.muted = !vid.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const vid = videoRef.current;
    if (vid) vid.requestFullscreen?.();
  }, []);

  // Find current subtitle
  const currentSub = project?.srt_file ? findCurrentSubtitle(clips, videoTime) : null;

  if (!videoSrc) {
    return (
      <div className="flex items-center justify-center bg-panel rounded-lg h-64">
        <p className="text-text-muted text-sm">Upload a video to preview</p>
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full aspect-video"
        onClick={togglePlay}
      />

      {/* Subtitle overlay */}
      {currentSub && (
        <div className="absolute bottom-16 left-0 right-0 text-center pointer-events-none">
          <span className="inline-block px-4 py-2 text-white text-lg font-bold uppercase"
                style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.6)' }}>
            {currentSub}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <input
          type="range"
          min={0}
          max={videoDuration || 0}
          step={0.1}
          value={videoTime}
          onChange={seek}
          className="w-full h-1 mb-2 appearance-none bg-text-dim/30 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        />
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} className="text-white hover:text-accent transition-colors">
            {videoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <span className="text-xs text-white/70 font-mono">
            {formatTime(videoTime)} / {formatTime(videoDuration)}
          </span>
          <div className="flex-1" />
          <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
            <Volume2 className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function findCurrentSubtitle(clips: any[], time: number): string | null {
  for (const clip of clips) {
    if (!clip.entries) continue;
    for (const entry of clip.entries) {
      const st = timeToSec(entry.start);
      const et = timeToSec(entry.end);
      if (time >= st && time <= et) return entry.text;
    }
  }
  return null;
}

function timeToSec(t: string): number {
  const clean = t.replace(',', '.').trim();
  const parts = clean.split(':');
  if (parts.length === 3) return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  return 0;
}
