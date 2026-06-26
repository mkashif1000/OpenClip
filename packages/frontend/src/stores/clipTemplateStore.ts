import { create } from 'zustand';

interface ClipTemplateState {
  // clipId → templateId (null means use project defaults)
  assignments: Record<string, string | null>;

  setClipTemplate: (clipId: string, templateId: string | null) => void;
  clearAll: () => void;
  getAssignmentsForProcessing: () => Record<string, string>;
}

export const useClipTemplateStore = create<ClipTemplateState>((set, get) => ({
  assignments: {},

  setClipTemplate: (clipId, templateId) =>
    set((s) => ({
      assignments: { ...s.assignments, [clipId]: templateId },
    })),

  clearAll: () => set({ assignments: {} }),

  getAssignmentsForProcessing: () => {
    const result: Record<string, string> = {};
    for (const [clipId, templateId] of Object.entries(get().assignments)) {
      if (templateId) result[clipId] = templateId;
    }
    return result;
  },
}));
