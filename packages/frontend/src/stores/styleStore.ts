import { create } from 'zustand';
import type { StyleConfig, SubtitleStyle, TitleStyle, ExportSettings } from '@/types';
import { DEFAULT_SUBTITLE_STYLE, DEFAULT_TITLE_STYLE, DEFAULT_EXPORT } from '@/types';
import { dbSaveStyles, dbGetStyles } from '@/services/db';
import { getCurrentProjectId } from './projectStore';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(projectId: string, styles: StyleConfig) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    dbSaveStyles(projectId, styles).catch(() => {});
  }, 500);
}

interface StyleState {
  styles: StyleConfig;
  setSubtitleStyle: (s: Partial<SubtitleStyle>) => void;
  setTitleStyle: (s: Partial<TitleStyle>) => void;
  setExportSettings: (s: Partial<ExportSettings>) => void;
  setStyles: (s: StyleConfig) => void;
  saveStyles: () => Promise<void>;
  loadStyles: (projectId: string) => Promise<void>;
  resetToDefaults: () => void;
}

export const useStyleStore = create<StyleState>((set, get) => ({
  styles: {
    subtitle: { ...DEFAULT_SUBTITLE_STYLE },
    title: { ...DEFAULT_TITLE_STYLE },
    export: { ...DEFAULT_EXPORT },
  },

  setSubtitleStyle: (s) => {
    set((state) => ({
      styles: { ...state.styles, subtitle: { ...state.styles.subtitle, ...s } },
    }));
    const pid = getCurrentProjectId();
    if (pid) debouncedSave(pid, get().styles);
  },

  setTitleStyle: (s) => {
    set((state) => ({
      styles: { ...state.styles, title: { ...state.styles.title, ...s } },
    }));
    const pid = getCurrentProjectId();
    if (pid) debouncedSave(pid, get().styles);
  },

  setExportSettings: (s) => {
    set((state) => ({
      styles: { ...state.styles, export: { ...state.styles.export, ...s } },
    }));
    const pid = getCurrentProjectId();
    if (pid) debouncedSave(pid, get().styles);
  },

  setStyles: (s) => {
    set({ styles: s });
    const pid = getCurrentProjectId();
    if (pid) debouncedSave(pid, s);
  },

  saveStyles: async () => {
    const pid = getCurrentProjectId();
    if (!pid) return;
    await dbSaveStyles(pid, get().styles);
  },

  loadStyles: async (projectId) => {
    const styles = await dbGetStyles(projectId);
    set({ styles });
  },

  resetToDefaults: () => {
    const defaults = {
      subtitle: { ...DEFAULT_SUBTITLE_STYLE },
      title: { ...DEFAULT_TITLE_STYLE },
      export: { ...DEFAULT_EXPORT },
    };
    set({ styles: defaults });
    const pid = getCurrentProjectId();
    if (pid) debouncedSave(pid, defaults);
  },
}));
