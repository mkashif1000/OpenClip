import { create } from 'zustand';

/**
 * Tracks which premade (podcast) template was last applied per project, so the
 * Process tab can show an "active template" indicator. Persisted to
 * localStorage keyed by project id — it's lightweight UI state, not worth a DB
 * schema field.
 */

const LS_KEY = 'openclip_active_templates';

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(map: Record<string, string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* ignore quota / private mode */ }
}

interface TemplateStatusState {
  activeByProject: Record<string, string>;
  setActive: (projectId: string, name: string) => void;
  clear: (projectId: string) => void;
}

export const useTemplateStatusStore = create<TemplateStatusState>((set) => ({
  activeByProject: load(),
  setActive: (projectId, name) =>
    set((s) => {
      const next = { ...s.activeByProject, [projectId]: name };
      save(next);
      return { activeByProject: next };
    }),
  clear: (projectId) =>
    set((s) => {
      const next = { ...s.activeByProject };
      delete next[projectId];
      save(next);
      return { activeByProject: next };
    }),
}));
