import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, X, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { opfsWriteFile, opfsGetBlobUrl } from '@/services/opfs';
import type { MusicTrack } from '@/types';

interface MusicPanelProps {
  onTrackSelect?: (track: MusicTrack | null) => void;
}

export function MusicPanel({ onTrackSelect }: MusicPanelProps) {
  const project = useProjectStore((s) => s.currentProject);
  const updateCurrentProject = useProjectStore((s) => s.updateCurrentProject);

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load tracks from project state
  useEffect(() => {
    if (project?.music_tracks?.length) {
      setTracks(project.music_tracks);
      const firstSelected = project.music_tracks.find((t: MusicTrack) => t.selected);
      if (firstSelected) onTrackSelect?.(firstSelected);
    }
  }, [project?.project_id]);

  // Resolve blob URLs for tracks stored in OPFS
  useEffect(() => {
    const resolve = async () => {
      const newUrls: Record<string, string> = {};
      for (const track of tracks) {
        if (track.path && !blobUrls[track.path]) {
          try {
            newUrls[track.path] = await opfsGetBlobUrl(track.path);
          } catch {
            // file may not be in OPFS yet (e.g., old data)
          }
        }
      }
      if (Object.keys(newUrls).length > 0) {
        setBlobUrls((prev) => ({ ...prev, ...newUrls }));
      }
    };
    resolve();
  }, [tracks]);

  const saveAndNotify = async (updated: MusicTrack[]) => {
    setTracks(updated);
    await updateCurrentProject({ music_tracks: updated });
    const firstSelected = updated.find((t) => t.selected);
    onTrackSelect?.(firstSelected || null);
  };

  const handleFilePicker = async () => {
    if ('showOpenFilePicker' in window) {
      // Modern File System Access API (Chrome/Edge)
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [{ description: 'Audio files', accept: { 'audio/*': ['.mp3', '.aac', '.m4a', '.wav', '.ogg', '.flac'] } }],
        });
        await importFiles(await Promise.all(handles.map((h: any) => h.getFile())));
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.error('File picker error:', err);
      }
    } else {
      // Firefox fallback: native file input
      fileInputRef.current?.click();
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) await importFiles(files);
    e.target.value = '';
  };

  const importFiles = async (files: File[]) => {
    if (!project?.project_id) return;
    setImporting(true);
    const newTracks: MusicTrack[] = [...tracks];

    for (const file of files) {
      const opfsId = `${project.project_id}_music_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      await opfsWriteFile(opfsId, file);
      const blobUrl = await opfsGetBlobUrl(opfsId);
      setBlobUrls((prev) => ({ ...prev, [opfsId]: blobUrl }));

      // Avoid duplicates
      if (!newTracks.find((t) => t.filename === file.name)) {
        newTracks.push({ path: opfsId, filename: file.name, volume: 0.1, selected: false });
      }
    }

    await saveAndNotify(newTracks);
    setImporting(false);
  };

  const toggleSelect = (idx: number) => {
    const updated = tracks.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t);
    saveAndNotify(updated);
  };

  const setVolume = (idx: number, vol: number) => {
    const clamped = Math.max(0, Math.min(100, vol));
    const updated = tracks.map((t, i) => i === idx ? { ...t, volume: clamped / 100 } : t);
    saveAndNotify(updated);
  };

  const removeTrack = async (idx: number) => {
    const updated = tracks.filter((_, i) => i !== idx);
    await saveAndNotify(updated);
  };

  const playAudio = (track: MusicTrack) => {
    stopAudio();
    const url = blobUrls[track.path];
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = Math.max(track.volume, 0.05);
    audio.play().catch(console.error);
    audio.onended = () => setPlayingPath(null);
    audioRef.current = audio;
    setPlayingPath(track.path);
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingPath(null);
  };

  const selectedCount = tracks.filter((t) => t.selected).length;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text flex items-center gap-2">
        <Volume2 className="w-4 h-4" />
        Background Music
      </h3>

      {/* Hidden file input fallback for Firefox */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.aac,.m4a,.wav,.ogg,.flac"
        onChange={handleInputChange}
        className="hidden"
      />

      <button
        onClick={handleFilePicker}
        disabled={importing || !project}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/20 glass-subtle text-text hover:bg-white/5 hover:border-white/40 text-sm font-medium transition-all w-full justify-center disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        {importing ? 'Importing…' : tracks.length > 0 ? 'Add More Tracks' : 'Import Music Files'}
      </button>

      <p className="text-[10px] text-text-dim">
        Music files are stored locally in your browser. Supports .mp3, .aac, .wav, .ogg
      </p>

      {tracks.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {tracks.map((track, idx) => (
            <div
              key={track.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                track.selected ? 'bg-white/10 border-white/20 shadow-soft' : 'glass-subtle border-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={track.selected}
                onChange={() => toggleSelect(idx)}
                className="switch shrink-0 scale-90"
              />
              <span className="text-xs font-medium text-text truncate flex-1" title={track.filename}>
                {track.filename}
              </span>

              {track.selected && (() => {
                const vol = Math.round(track.volume * 100);
                return (
                  <div className="flex items-center gap-2 shrink-0 bg-[#111]/50 px-2 py-1.5 rounded-lg border border-white/5">
                    <Volume2 className="w-3.5 h-3.5 text-text-dim" />
                    <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg p-1 w-16 shadow-inner">
                      <input
                        type="number" min={0} max={100}
                        value={vol}
                        onChange={(e) => setVolume(idx, Number(e.target.value))}
                        className="w-full bg-transparent text-text text-xs font-mono text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="flex flex-col border-l border-white/10 pl-1">
                        <button 
                          onClick={() => setVolume(idx, Math.min(100, vol + 1))} 
                          className="hover:bg-white/10 rounded px-0.5 text-text-dim hover:text-white transition-colors"
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                        <button 
                          onClick={() => setVolume(idx, Math.max(0, vol - 1))} 
                          className="hover:bg-white/10 rounded px-0.5 text-text-dim hover:text-white transition-colors"
                        >
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] text-text-dim font-mono">%</span>
                  </div>
                );
              })()}

              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  onClick={() => playingPath === track.path ? stopAudio() : playAudio(track)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text transition-colors"
                >
                  {playingPath === track.path ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => removeTrack(idx)}
                  className="p-1.5 rounded-lg hover:bg-error/20 text-text-dim hover:text-error transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCount > 1 && (
        <p className="text-[10px] text-text-dim">
          {selectedCount} tracks selected — one randomly assigned per clip.
        </p>
      )}
    </div>
  );
}
