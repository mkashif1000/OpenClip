import { create } from 'zustand';

/**
 * App-wide settings that live in localStorage (not tied to any project).
 * API keys (AssemblyAI transcription; Pexels/Pixabay B-roll) are configured
 * once here and reused everywhere.
 *
 * Safety: keys are kept only in this browser's localStorage, sent only to their
 * providers over HTTPS, and are never written into project data, OPFS, or the
 * repository.
 */

const STORAGE = {
  assemblyai: 'openclip_assemblyai_key',
  pexels: 'openclip_pexels_key',
  pixabay: 'openclip_pixabay_key',
} as const;

function readKey(name: keyof typeof STORAGE): string {
  try {
    return localStorage.getItem(STORAGE[name]) ?? '';
  } catch {
    return '';
  }
}

function writeKey(name: keyof typeof STORAGE, value: string): string {
  const trimmed = value.trim();
  try {
    if (trimmed) localStorage.setItem(STORAGE[name], trimmed);
    else localStorage.removeItem(STORAGE[name]);
  } catch { /* storage unavailable */ }
  return trimmed;
}

interface SettingsState {
  assemblyaiKey: string;
  pexelsKey: string;
  pixabayKey: string;
  settingsOpen: boolean;
  setAssemblyaiKey: (key: string) => void;
  clearAssemblyaiKey: () => void;
  setPexelsKey: (key: string) => void;
  setPixabayKey: (key: string) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  assemblyaiKey: readKey('assemblyai'),
  pexelsKey: readKey('pexels'),
  pixabayKey: readKey('pixabay'),
  settingsOpen: false,
  setAssemblyaiKey: (key) => set({ assemblyaiKey: writeKey('assemblyai', key) }),
  clearAssemblyaiKey: () => set({ assemblyaiKey: writeKey('assemblyai', '') }),
  setPexelsKey: (key) => set({ pexelsKey: writeKey('pexels', key) }),
  setPixabayKey: (key) => set({ pixabayKey: writeKey('pixabay', key) }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
