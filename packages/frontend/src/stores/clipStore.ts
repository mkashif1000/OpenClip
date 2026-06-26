import { create } from 'zustand';
import type { ClipData } from '@/types';
import { dbSaveClips, dbUpdateClip, dbDeleteClip, dbAddClip } from '@/services/db';
import {
  detectClipsFromSrt, loadClipsFromJsonFile, loadClipsFromJsonData,
  createManualClip, extractEntriesForRange,
} from '@/services/clipDetector';
import { getCurrentProjectId, useProjectStore } from './projectStore';

interface ClipState {
  clips: ClipData[];
  selectedClipId: string | null;

  setClips: (clips: ClipData[]) => void;
  selectClip: (id: string | null) => void;
  detectClips: (srtFileId: string, params: { min_duration: number; max_duration: number; max_clips: number }) => Promise<void>;
  loadJsonClips: (jsonFileId: string, srtFileId: string) => Promise<void>;
  /** Load clips from parsed JSON (e.g. pasted from a chatbot). Returns count. */
  loadClipsFromParsed: (jsonData: unknown) => Promise<number>;
  addClip: (data: { title: string; start_time: number; end_time: number }) => Promise<void>;
  updateClip: (clipId: string, data: Partial<ClipData>) => Promise<void>;
  removeClip: (clipId: string) => Promise<void>;
  updateClipStatus: (clipId: string, status: ClipData['status'], outputFile?: string, outputBlob?: Blob) => void;
  refreshEntriesForClip: (clipId: string, srtFileId: string) => Promise<void>;
}

export const useClipStore = create<ClipState>((set, get) => ({
  clips: [],
  selectedClipId: null,

  setClips: (clips) => {
    set({ clips });
    const projectId = getCurrentProjectId();
    if (projectId) dbSaveClips(projectId, clips).catch(console.error);
  },

  selectClip: (id) => set({ selectedClipId: id }),

  detectClips: async (srtFileId, params) => {
    const projectId = getCurrentProjectId();
    if (!projectId) return;

    const clips = await detectClipsFromSrt(srtFileId, params);
    await dbSaveClips(projectId, clips);
    set({ clips });
  },

  loadJsonClips: async (jsonFileId, srtFileId) => {
    const projectId = getCurrentProjectId();
    if (!projectId) return;

    const clips = await loadClipsFromJsonFile(jsonFileId, srtFileId);
    await dbSaveClips(projectId, clips);
    set({ clips });
  },

  loadClipsFromParsed: async (jsonData) => {
    const projectId = getCurrentProjectId();
    if (!projectId) return 0;
    const proj = useProjectStore.getState().currentProject;
    const srtId = proj?.srt_file?.path;
    if (!srtId) throw new Error('Generate or upload subtitles first, then load clips.');

    const clips = await loadClipsFromJsonData(jsonData, srtId);
    await dbSaveClips(projectId, clips);
    set({ clips });
    return clips.length;
  },

  addClip: async (data) => {
    const projectId = getCurrentProjectId();
    if (!projectId) return;

    const { clips } = get();
    const clip = createManualClip(data.title, data.start_time, data.end_time, clips.length);
    await dbAddClip(projectId, clip);
    set((s) => ({ clips: [...s.clips, clip] }));
  },

  updateClip: async (clipId, data) => {
    const projectId = getCurrentProjectId();
    if (!projectId) return;

    // Recalculate duration if times changed
    const existing = get().clips.find((c) => c.clip_id === clipId);
    const updates = { ...data };
    if ((data.start_time !== undefined || data.end_time !== undefined) && existing) {
      const st = data.start_time ?? existing.start_time;
      const et = data.end_time ?? existing.end_time;
      updates.duration = et - st;
    }

    await dbUpdateClip(projectId, clipId, updates);
    set((s) => ({
      clips: s.clips.map((c) => (c.clip_id === clipId ? { ...c, ...updates } : c)),
    }));
  },

  removeClip: async (clipId) => {
    await dbDeleteClip(clipId);
    set((s) => ({
      clips: s.clips.filter((c) => c.clip_id !== clipId),
      selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
    }));
  },

  updateClipStatus: (clipId, status, outputFile, _outputBlob) => {
    const projectId = getCurrentProjectId();
    set((s) => ({
      clips: s.clips.map((c) =>
        c.clip_id === clipId
          ? { ...c, status, output_file: outputFile ?? c.output_file }
          : c,
      ),
    }));
    if (projectId) {
      dbUpdateClip(projectId, clipId, {
        status,
        output_file: outputFile,
      }).catch(console.error);
    }
  },

  refreshEntriesForClip: async (clipId, srtFileId) => {
    const clip = get().clips.find((c) => c.clip_id === clipId);
    if (!clip) return;
    const entries = await extractEntriesForRange(srtFileId, clip.start_time, clip.end_time);
    await get().updateClip(clipId, { entries });
  },
}));
