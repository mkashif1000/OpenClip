import { create } from 'zustand';
import type { TabId } from '@/types';

interface UIState {
  workspaceMode: 'quick' | 'advanced';
  activeTab: TabId;
  sidebarCollapsed: boolean;
  videoTime: number;
  videoDuration: number;
  videoPlaying: boolean;

  isLandingPage: boolean;
  setLandingPage: (val: boolean) => void;
  setWorkspaceMode: (mode: 'quick' | 'advanced') => void;
  setActiveTab: (tab: TabId) => void;
  toggleSidebar: () => void;
  setVideoTime: (t: number) => void;
  setVideoDuration: (d: number) => void;
  setVideoPlaying: (p: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  workspaceMode: 'quick',
  isLandingPage: true,
  activeTab: 'import',
  sidebarCollapsed: false,
  videoTime: 0,
  videoDuration: 0,
  videoPlaying: false,

  setLandingPage: (val) => set({ isLandingPage: val }),
  setWorkspaceMode: (workspaceMode) => set({ workspaceMode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setVideoTime: (t) => set({ videoTime: t }),
  setVideoDuration: (d) => set({ videoDuration: d }),
  setVideoPlaying: (p) => set({ videoPlaying: p }),
}));
