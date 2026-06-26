import { create } from 'zustand';
import type { RenderProgress } from '@/services/renderService';
import type { StyleConfig, PIPConfig, Template } from '@/types';
import type { LayoutType } from '@/services/canvasRenderer';
import { renderClip, cancelRender, downloadBlob, getClipFilename } from '@/services/renderService';
import { useClipStore } from './clipStore';
import { useSettingsStore } from './settingsStore';

import { getCurrentProjectId } from './projectStore';

interface ClipProgressData {
  percent: number;
  eta: number;
  currentFps: number;
  phase: string;
}

interface ProcessingState {
  isProcessing: boolean;
  clipProgress: Record<string, ClipProgressData>;
  completedClips: number;
  failedClips: number;
  totalClips: number;
  outputBlobs: Record<string, Blob>;   // clipId → rendered Blob

  renderClips: (clipIds: string[], overrides?: Record<string, ClipOverride>) => Promise<void>;
  cancelRendering: () => void;
  downloadClip: (clipId: string) => void;
  hydrateOutputs: () => Promise<void>;
  reset: () => void;
}

export interface ClipOverride {
  pip?: {
    contentBox: { x: number; y: number; width: number; height: number };
    speakerBox: { x: number; y: number; width: number; height: number };
    splitRatio: number;
    pipStartSec?: number;
    pipEndSec?: number;
  };
  subtitle?: Partial<StyleConfig['subtitle']>;
  title?: Partial<StyleConfig['title']>;
}

export const useProcessingStore = create<ProcessingState>((set, get) => ({
  isProcessing: false,
  clipProgress: {},
  completedClips: 0,
  failedClips: 0,
  totalClips: 0,
  outputBlobs: {},

  renderClips: async (clipIds, overrides = {}) => {
    const { clips } = useClipStore.getState();
    const projectId = getCurrentProjectId();
    if (!projectId) return;

    const targetClips = clips.filter((c) => clipIds.includes(c.clip_id));
    if (!targetClips.length) return;

    set((s) => {
      // Only drop in-memory outputs for the clips being (re-)rendered — other
      // clips' rendered outputs stay visible in the gallery.
      const outputBlobs = { ...s.outputBlobs };
      for (const id of clipIds) delete outputBlobs[id];
      return {
        isProcessing: true,
        clipProgress: {},
        completedClips: 0,
        failedClips: 0,
        totalClips: targetClips.length,
        outputBlobs,
      };
    });

    let completed = 0;
    let failed = 0;
    // Whisper word timeline, loaded once per batch (undefined = not loaded yet).
    let whisperWords: Array<{ t0: number; t1: number; text: string }> | null | undefined;

    // Resolve project styles + per-clip template assignments once up front.
    const { useStyleStore } = await import('./styleStore');
    const baseStyles = useStyleStore.getState().styles;
    const { useClipTemplateStore } = await import('./clipTemplateStore');
    const assignments = useClipTemplateStore.getState().assignments;
    const templateMap = new Map<string, Template>();
    try {
      const { dbGetTemplates } = await import('@/services/db');
      for (const t of await dbGetTemplates()) templateMap.set(t.template_id, t);
    } catch { /* no templates available */ }

    for (const clip of targetClips) {
      if (!get().isProcessing) break; // cancelled

      const override = overrides[clip.clip_id];

      // An assigned template provides the base styles/layout for this clip;
      // RePIP "Customize" overrides still take precedence on top.
      const assignedId = assignments[clip.clip_id] ?? null;
      const template = assignedId ? templateMap.get(assignedId) : undefined;
      const base = template?.styles ?? baseStyles;

      const styleConfig: StyleConfig = {
        subtitle: { ...base.subtitle, ...(override?.subtitle || {}) },
        // Per-clip titleFont (from the Edit tab) wins over the base/template title.
        title: {
          ...base.title,
          ...(override?.title || {}),
          ...(clip.edits?.titleFont ? { font_name: clip.edits.titleFont } : {}),
        },
        // Export/encode settings (format, B-roll, face-tracking, silence removal)
        // are global choices from the Style/Process panel — a saved template must
        // not shadow them. Otherwise enabling e.g. B-roll would be silently
        // ignored for any clip that has a template assigned.
        export: baseStyles.export,
      };

      const exportS = styleConfig.export;
      const vertical = (exportS.format || 'match_source') !== 'horizontal';
      let outputWidth = exportS.width || (vertical ? 720 : 1280);
      let outputHeight = exportS.height || (vertical ? 1280 : 720);

      // Resolve video OPFS ID from project
      const { useProjectStore } = await import('./projectStore');
      const project = useProjectStore.getState().currentProject;
      if (!project?.video_file?.path) {
        failed++;
        useClipStore.getState().updateClipStatus(clip.clip_id, 'failed');
        set((s) => ({ failedClips: s.failedClips + 1 }));
        continue;
      }

      const videoOpfsId = project.video_file.path;
      // Use the probed source frame rate so motion stays as smooth as the
      // input (clamped to a sane range; 30 when the probe didn't run).
      const fps = Math.min(Math.max(project.video_file.fps ?? 30, 10), 60);

      // "Match Source": derive the output from the source resolution so there
      // is no quality loss from downscaling (capped at 1080p-class — the
      // upper bound of broadly supported H.264 level 4.0 encoders).
      if (exportS.format === 'match_source' && project.video_file.width && project.video_file.height) {
        const srcW = project.video_file.width;
        const srcH = project.video_file.height;
        if (vertical) {
          outputHeight = Math.min(srcH, 1920);
          outputWidth = Math.min(Math.round(outputHeight * 9 / 16), srcW);
        } else {
          outputWidth = Math.min(srcW, 1920);
          outputHeight = Math.min(srcH, 1080);
        }
      }

      // Resolve PIP config from override or template
      let pipConfig: PIPConfig | null = null;
      let layoutType: LayoutType = 'standard';
      let pipStartSec: number | undefined;
      let pipEndSec: number | undefined;

      if (override?.pip) {
        pipConfig = {
          contentBox: override.pip.contentBox,
          speakerBox: override.pip.speakerBox,
          splitRatio: override.pip.splitRatio,
        };
        if (override.pip.pipStartSec != null && override.pip.pipEndSec != null) {
          layoutType = 'hybrid';
          pipStartSec = override.pip.pipStartSec;
          pipEndSec = override.pip.pipEndSec;
        } else {
          layoutType = 'pip';
        }
      } else if (clip.edits?.layout === 'pip' && clip.edits.pipConfig) {
        // Per-clip PIP from the Edit tab takes precedence over templates.
        pipConfig = clip.edits.pipConfig;
        layoutType = 'pip';
      } else if (
        clip.edits?.layout === 'gameplay' ||
        clip.edits?.layout === 'split-2v' ||
        clip.edits?.layout === 'split-3' ||
        clip.edits?.layout === 'split-4' ||
        clip.edits?.layout === 'boxed'
      ) {
        // Multi-source split layouts + boxed — canvasRenderer handles them.
        layoutType = clip.edits.layout;
      } else if (template?.layout === 'pip' && template.pip_config) {
        // Use the assigned template's PIP layout.
        pipConfig = template.pip_config;
        layoutType = 'pip';
      }

      // Resolve music
      const selectedTrack = (project.music_tracks || []).find((t) => t.selected);
      const musicOpfsId = selectedTrack?.path || null;  // path stores OPFS id in new arch

      useClipStore.getState().updateClipStatus(clip.clip_id, 'processing');

      // Silence/filler removal + user-disabled transcript words. We compute
      // keepSegments whenever EITHER the silence-removal toggle is on OR the
      // user has disabled transcript words in the Edit tab. Both can be active
      // at once — they merge into a single cut list.
      let keepSegments: Array<{ start: number; end: number }> | null = null;
      const userCuts = clip.edits?.cutRanges ?? [];
      const wantAuto = !!styleConfig.export.remove_silences;
      if ((wantAuto || userCuts.length) && project.whisper_words) {
        try {
          if (whisperWords === undefined) {
            whisperWords = null;
            const { opfsReadFile } = await import('@/services/opfs');
            const f = await opfsReadFile(project.whisper_words);
            whisperWords = JSON.parse(await f.text());
          }
          if (whisperWords?.length) {
            const { computeKeepSegments } = await import('@/services/silenceCuts');
            const segs = computeKeepSegments(whisperWords, clip.start_time, clip.end_time, {
              autoCuts: wantAuto,
              extraCutRanges: userCuts,
            });
            const total = segs.reduce((s, k) => s + (k.end - k.start), 0);
            if (segs.length > 1 || total < clip.duration - 0.05) keepSegments = segs;
          }
        } catch (err) {
          console.warn('Silence/transcript cuts unavailable for this clip:', err);
        }
      }

      // Title override from per-clip edits.
      // `!= null` (not truthy) so an explicit empty string hides the title —
      // used by the "Clean Captions" template.
      const renderedClip = clip.edits?.customTitle != null
        ? { ...clip, title: clip.edits.customTitle }
        : clip;

      // Face tracking pre-pass (auto-center the speaker).
      let faceTrack: { at(t: number): { x: number; y: number } | null } | null = null;
      if (styleConfig.export.face_tracking !== false) {
        try {
          set((s) => ({
            clipProgress: {
              ...s.clipProgress,
              [clip.clip_id]: { percent: 1, eta: 0, currentFps: 0, phase: 'analyzing' },
            },
          }));
          const { buildFaceTrack } = await import('@/services/faceTracker');
          faceTrack = await buildFaceTrack({
            videoOpfsId,
            startSec: clip.start_time,
            endSec: clip.end_time,
          });
        } catch (err) {
          console.warn('Face tracking unavailable, using centered crop:', err);
        }
      }
      if (!get().isProcessing) break; // cancelled during analysis

      // B-roll prep: user-curated B-roll from the Edit tab takes precedence
      // over the auto-planner. Each item references an OPFS file we read +
      // probe for duration.
      let brollPlan: Array<{ startSec: number; endSec: number; file: File; clipDurationSec: number }> | null = null;
      const userBrolls = clip.edits?.brolls ?? [];
      if (userBrolls.length && layoutType !== 'pip') {
        try {
          const { opfsReadFile } = await import('@/services/opfs');
          const { probeVideoFile } = await import('@/services/ffmpegService');
          const items: Array<{ startSec: number; endSec: number; file: File; clipDurationSec: number }> = [];
          for (const b of userBrolls) {
            if (!get().isProcessing) break;
            try {
              const file = await opfsReadFile(b.fileId);
              let dur = 0;
              try { dur = (await probeVideoFile(file)).duration || 0; } catch { /* fall back to span dur */ }
              items.push({
                startSec: b.startSec, endSec: b.endSec, file,
                clipDurationSec: Math.max(dur, b.endSec - b.startSec, 0.5),
              });
            } catch (err) {
              console.warn('Skipping B-roll item — file read failed:', err);
            }
          }
          if (items.length) brollPlan = items;
        } catch (err) {
          console.warn('User B-roll prep failed; falling through to auto planner:', err);
        }
      }
      const { pexelsKey, pixabayKey } = useSettingsStore.getState();
      if (!brollPlan && styleConfig.export.broll && project.whisper_words && (pexelsKey || pixabayKey) && layoutType !== 'pip') {
        try {
          if (whisperWords === undefined) {
            whisperWords = null;
            const { opfsReadFile } = await import('@/services/opfs');
            const f = await opfsReadFile(project.whisper_words);
            whisperWords = JSON.parse(await f.text());
          }
          if (whisperWords?.length) {
            set((s) => ({
              clipProgress: { ...s.clipProgress, [clip.clip_id]: { percent: 2, eta: 0, currentFps: 0, phase: 'finding b-roll' } },
            }));
            const { planBroll } = await import('@/services/brollPlanner');
            const avoid = layoutType === 'hybrid' && pipStartSec != null && pipEndSec != null
              ? [{ start: clip.start_time + pipStartSec, end: clip.start_time + pipEndSec }]
              : [];
            const spans = planBroll(whisperWords, clip.start_time, clip.end_time, { avoidRanges: avoid });
            if (spans.length) {
              const { fetchBrollClip } = await import('@/services/brollService');
              const orientation = vertical ? 'portrait' : 'landscape';
              const keys = { pexels: pexelsKey || undefined, pixabay: pixabayKey || undefined };
              const exclude = new Set<string>();
              const items: Array<{ startSec: number; endSec: number; file: File; clipDurationSec: number }> = [];
              for (const span of spans) {
                if (!get().isProcessing) break;
                const r = await fetchBrollClip(span.query, orientation, span.end - span.start, keys, exclude);
                if (r) items.push({ startSec: span.start, endSec: span.end, file: r.file, clipDurationSec: r.candidate.durationSec });
              }
              if (items.length) {
                brollPlan = items;
                // Persist the auto-downloaded brolls so the Edit tab can
                // display + tweak them next session. Each File goes into OPFS
                // and we save a ClipBroll entry on clip.edits.brolls.
                try {
                  const { opfsWriteBytes } = await import('@/services/opfs');
                  const persisted: import('@/types').ClipBroll[] = [];
                  for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    const fileId = `${project.project_id}_autobroll_${clip.clip_id}_${i}_${Date.now()}`;
                    const bytes = new Uint8Array(await it.file.arrayBuffer());
                    await opfsWriteBytes(fileId, bytes);
                    persisted.push({
                      id: `auto_${i}_${Date.now()}`,
                      startSec: it.startSec, endSec: it.endSec,
                      fileId,
                      label: it.file.name || `Auto B-roll ${i + 1}`,
                    });
                  }
                  if (persisted.length) {
                    await useClipStore.getState().updateClip(clip.clip_id, {
                      edits: { ...(clip.edits ?? {}), brolls: persisted },
                    });
                  }
                } catch (err) {
                  console.warn('Auto B-roll persistence failed:', err);
                }
              }
            }
          }
        } catch (err) {
          console.warn('B-roll prep failed; rendering without B-roll:', err);
        }
      }
      if (!get().isProcessing) break; // cancelled during B-roll prep

      try {
        const blob = await renderClip(
          {
            videoOpfsId,
            clip: renderedClip,
            styleConfig,
            pipConfig,
            layoutType,
            pipStartSec,
            pipEndSec,
            logoOpfsId: project.logo_config?.file_id ?? null,
            logoConfig: project.logo_config ?? null,
            musicOpfsId,
            musicVolume: selectedTrack?.volume ?? 0.1,
            outputWidth,
            outputHeight,
            fps,
            keepSegments,
            faceTrack,
            brollPlan,
            regionCrops: clip.edits?.regionCrops ?? null,
          },
          (progress: RenderProgress) => {
            set((s) => ({
              clipProgress: {
                ...s.clipProgress,
                [clip.clip_id]: {
                  percent: progress.percent,
                  eta: progress.eta,
                  currentFps: progress.currentFps,
                  phase: progress.phase,
                },
              },
            }));
          },
        );

        completed++;
        const filename = getClipFilename(clip, clip.index);

        // Store output blob in memory and update clip status
        set((s) => ({
          outputBlobs: { ...s.outputBlobs, [clip.clip_id]: blob },
          completedClips: s.completedClips + 1,
          clipProgress: {
            ...s.clipProgress,
            [clip.clip_id]: { percent: 100, eta: 0, currentFps: 0, phase: 'done' },
          },
        }));

        useClipStore.getState().updateClipStatus(clip.clip_id, 'completed', filename, blob);

        // Persist the rendered MP4 to OPFS so it survives refresh. The id is
        // deterministic per clip, so a re-render replaces the previous output.
        try {
          const outId = `${projectId}_out_${clip.clip_id}`;
          const { opfsWriteBytes } = await import('@/services/opfs');
          await opfsWriteBytes(outId, new Uint8Array(await blob.arrayBuffer()));
          const { dbRegisterFile } = await import('@/services/db');
          await dbRegisterFile({
            file_id: outId,
            filename,
            file_type: 'output',
            size_bytes: blob.size,
            opfs_id: outId,
            project_id: projectId,
          });
        } catch (err) {
          console.warn('Failed to persist rendered clip:', err);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') break;
        console.error(`Render failed for clip ${clip.clip_id}:`, err);
        failed++;
        useClipStore.getState().updateClipStatus(clip.clip_id, 'failed');
        set((s) => ({
          failedClips: s.failedClips + 1,
          clipProgress: {
            ...s.clipProgress,
            [clip.clip_id]: { percent: 0, eta: 0, currentFps: 0, phase: 'failed' },
          },
        }));
      }
    }

    set({ isProcessing: false });
  },

  cancelRendering: () => {
    cancelRender();
    set({ isProcessing: false });
  },

  downloadClip: (clipId) => {
    const { outputBlobs } = get();
    const { clips } = useClipStore.getState();
    const clip = clips.find((c) => c.clip_id === clipId);
    const blob = outputBlobs[clipId];
    if (blob && clip) {
      downloadBlob(blob, getClipFilename(clip, clip.index));
    }
  },

  // Reload persisted rendered outputs from OPFS (after a page refresh or
  // project switch) for completed clips that aren't in memory yet.
  hydrateOutputs: async () => {
    const projectId = getCurrentProjectId();
    if (!projectId) return;
    const { clips } = useClipStore.getState();
    const { outputBlobs } = get();
    const missing = clips.filter((c) => c.status === 'completed' && !outputBlobs[c.clip_id]);
    if (!missing.length) return;

    const { opfsReadFile } = await import('@/services/opfs');
    const loaded: Record<string, Blob> = {};
    for (const clip of missing) {
      try {
        loaded[clip.clip_id] = await opfsReadFile(`${projectId}_out_${clip.clip_id}`);
      } catch { /* nothing persisted for this clip */ }
    }
    if (Object.keys(loaded).length) {
      set((s) => ({ outputBlobs: { ...s.outputBlobs, ...loaded } }));
    }
  },

  reset: () =>
    set({
      isProcessing: false,
      clipProgress: {},
      completedClips: 0,
      failedClips: 0,
      totalClips: 0,
    }),
}));
