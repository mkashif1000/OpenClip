import { create } from 'zustand';
import type { TabId } from '@/types';

interface UIState {
  activeTab: TabId;
  sidebarCollapsed: boolean;
  videoTime: number;
  videoDuration: number;
  videoPlaying: boolean;

  setActiveTab: (tab: TabId) => void;
  toggleSidebar: () => void;
  setVideoTime: (t: number) => void;
  setVideoDuration: (d: number) => void;
  setVideoPlaying: (p: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'import',
  sidebarCollapsed: false,
  videoTime: 0,
  videoDuration: 0,
  videoPlaying: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setVideoTime: (t) => set({ videoTime: t }),
  setVideoDuration: (d) => set({ videoDuration: d }),
  setVideoPlaying: (p) => set({ videoPlaying: p }),
}));
