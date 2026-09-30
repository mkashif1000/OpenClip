import { create } from 'zustand';
import type { Project, FileUpload } from '@/types';
import {
  dbSaveProject, dbGetProject, dbListProjects, dbDeleteProject,
  dbUpdateProject, dbRegisterFile, dbGetProjectFiles,
} from '@/services/db';
import { opfsWriteFile, opfsDeleteFiles } from '@/services/opfs';
import { createPreviewProxy, probeVideoFile } from '@/services/ffmpegService';
import { getPerformanceProfile } from '@/services/performanceProfile';
import { registerPreviewSource } from '@/services/thumbnails';

let projectIdGlobal: string | null = null;

/** Expose current project ID globally for stores that need it without subscribing */
export function getCurrentProjectId(): string | null {
  return projectIdGlobal;
}

// Skip the background heal for very large files — writing GBs into ffmpeg's
// MEMFS to read a one-line probe is not worth it; the render path probes
// lazily anyway.
const MAX_HEAL_BYTES = 500 * 1024 * 1024;
const healing = new Set<string>();
const proxyJobs = new Set<string>();

async function healVideoMetadata(projectId: string, videoFile: FileUpload): Promise<void> {
  if (healing.has(projectId)) return;
  if (videoFile.size_bytes && videoFile.size_bytes > MAX_HEAL_BYTES) return;
  healing.add(projectId);
  try {
    const { opfsReadFile } = await import('@/services/opfs');
    const file = await opfsReadFile(videoFile.path);
    const info = await probeVideoFile(file);
    if (!info.width || !info.height) return;
    if (projectIdGlobal !== projectId) return; // user switched away
    const updated: FileUpload = {
      ...videoFile,
      duration: info.duration || videoFile.duration,
      width: info.width, height: info.height, fps: info.fps,
    };
    await dbUpdateProject(projectId, { video_file: updated });
    // Patch the live store only if it's still showing this project.
    const store = useProjectStore.getState();
    if (store.currentProjectId === projectId && store.currentProject) {
      useProjectStore.setState({ currentProject: { ...store.currentProject, video_file: updated } });
    }
  } catch {
    // Heal is best-effort; render still works at the cached metadata.
  } finally {
    healing.delete(projectId);
  }
}

async function preparePreviewProxy(projectId: string, videoFile: FileUpload): Promise<void> {
  const profile = getPerformanceProfile();
  // Small videos are already cheap to seek. Proxy only large inputs on devices
  // that benefit from it, and do the work after import so the UI opens instantly.
  if (profile.tier === 'high' || videoFile.size_bytes < 80 * 1024 * 1024) return;
  if (proxyJobs.has(projectId)) return;
  proxyJobs.add(projectId);
  const previewId = `${projectId}_preview_${Date.now()}`;
  try {
    const { size_bytes } = await createPreviewProxy(videoFile.path, previewId, profile.previewWidth);
    const preview: FileUpload = {
      file_id: previewId,
      filename: `${videoFile.filename}.preview.mp4`,
      file_type: 'video',
      size_bytes,
      path: previewId,
      duration: videoFile.duration,
      width: profile.previewWidth,
      height: 0,
      fps: 30,
    };
    await dbRegisterFile({
      file_id: previewId,
      filename: preview.filename,
      file_type: 'video',
      size_bytes,
      opfs_id: previewId,
      project_id: projectId,
      duration: preview.duration,
      width: preview.width,
      height: preview.height,
    });
    await dbUpdateProject(projectId, { preview_file: preview });
    registerPreviewSource(videoFile.path, previewId);
    const store = useProjectStore.getState();
    if (store.currentProjectId === projectId && store.currentProject) {
      useProjectStore.setState({ currentProject: { ...store.currentProject, preview_file: preview } });
    }
  } catch (error) {
    console.warn('Preview proxy generation skipped:', error);
  } finally {
    proxyJobs.delete(projectId);
  }
}

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  currentProject: Project | null;
  loading: boolean;

  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project>;
  selectProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setFile: (fileType: string, file: File, onProgress?: (pct: number) => void) => Promise<void>;
  refreshProject: () => Promise<void>;
  updateCurrentProject: (updates: Partial<Project>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  currentProject: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    const projects = await dbListProjects();
    set({ projects, loading: false });
    const { currentProjectId, selectProject } = get();
    if (!currentProjectId && projects.length > 0) {
      await selectProject(projects[0].project_id);
    }
  },

  createProject: async (name) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project: Project = {
      project_id: id,
      name,
      created_at: now,
      video_file: null,
      srt_file: null,
      json_file: null,
      clips: [],
      styles: {
        subtitle: {
          font_name: 'Arial', font_size: null, bold: true,
          primary_color: '#FFFFFF', highlight_color: '#FFFF00',
          outline_color: '#000000', outline_width: 4,
          position: 'bottom', margin_v: null,
        },
        title: {
          font_size: null, font_color: '#FFFFFF', bg_color: '#000000',
          bg_opacity: 0.75, padding: 20, position: 'top',
          position_y: 5, border_radius: 6, max_chars_per_line: null,
        },
        export: {
          format: 'match_source', width: 720, height: 1280,
          codec: 'libx264', crf: 23, preset: 'fast', audio_bitrate: '128k',
        },
      },
      status: 'idle',
    };

    await dbSaveProject(project);
    projectIdGlobal = id;
    set((s) => ({
      projects: [project, ...s.projects],
      currentProjectId: id,
      currentProject: project,
    }));
    return project;
  },

  selectProject: async (id) => {
    set({ loading: true });
    projectIdGlobal = id;
    const project = await dbGetProject(id);
    set({ currentProjectId: id, currentProject: project, loading: false });
    if (project?.video_file?.path && project.preview_file?.path) {
      registerPreviewSource(project.video_file.path, project.preview_file.path);
    } else if (project?.video_file) {
      void preparePreviewProxy(id, project.video_file);
    }

    // Heal projects whose video metadata was captured by the old probe that
    // returned 0x0 @ 30fps on files with parenthesized pixel-format fields
    // (e.g. `yuv420p(tv, bt709)`). Runs in the background so opening the
    // project is instant — ffmpeg.wasm load + multi-GB OPFS read can stall for
    // many seconds and used to block project selection. When it succeeds we
    // patch the store + DB; if the user switches projects mid-probe we drop
    // the result.
    if (project?.video_file?.path && (!project.video_file.width || !project.video_file.height)) {
      void healVideoMetadata(id, project.video_file);
    }
  },

  renameProject: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await dbUpdateProject(id, { name: trimmed });
    set((s) => ({
      projects: s.projects.map((p) => (p.project_id === id ? { ...p, name: trimmed } : p)),
      currentProject:
        s.currentProject?.project_id === id
          ? { ...s.currentProject, name: trimmed }
          : s.currentProject,
    }));
  },

  deleteProject: async (id) => {
    // Delete all OPFS files for this project
    const files = await dbGetProjectFiles(id);
    const opfsIds = files.map((f) => f.opfs_id);
    await opfsDeleteFiles(opfsIds);

    await dbDeleteProject(id);
    set((s) => ({
      projects: s.projects.filter((p) => p.project_id !== id),
      currentProjectId: s.currentProjectId === id ? null : s.currentProjectId,
      currentProject: s.currentProjectId === id ? null : s.currentProject,
    }));
    if (projectIdGlobal === id) projectIdGlobal = null;
  },

  setFile: async (fileType, file, onProgress) => {
    let currentProjectId = get().currentProjectId;
    let currentProject = get().currentProject;
    if (!currentProjectId || !currentProject) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 32) || 'My Project';
      const created = await get().createProject(cleanName);
      currentProjectId = created.project_id;
      currentProject = created;
    }

    const fileId = `${currentProjectId}_${fileType}_${Date.now()}`;

    // Write to OPFS with progress
    await opfsWriteFile(fileId, file, onProgress);

    // Build FileUpload metadata
    let fileData: FileUpload = {
      file_id: fileId,
      filename: file.name,
      file_type: fileType as FileUpload['file_type'],
      size_bytes: file.size,
      path: fileId, // OPFS id used as path
    };

    // Probe video metadata if it's a video file
    if (fileType === 'video') {
      try {
        const info = await probeVideoFile(file);
        fileData = { ...fileData, duration: info.duration, width: info.width, height: info.height, fps: info.fps };
      } catch (err) {
        console.warn('Video probe failed:', err);
      }
    }

    // Register in file DB
    await dbRegisterFile({
      file_id: fileId,
      filename: file.name,
      file_type: fileType as any,
      size_bytes: file.size,
      opfs_id: fileId,
      project_id: currentProjectId,
      duration: fileData.duration,
      width: fileData.width,
      height: fileData.height,
    });

    const key = `${fileType}_file` as keyof Project;
    const updatedProject = { ...currentProject, [key]: fileData };
    await dbUpdateProject(currentProjectId, { [key]: fileData });
    set({ currentProject: updatedProject });
    if (fileType === 'video') void preparePreviewProxy(currentProjectId, fileData);
  },

  refreshProject: async () => {
    const { currentProjectId } = get();
    if (!currentProjectId) return;
    const project = await dbGetProject(currentProjectId);
    set({ currentProject: project });
  },

  updateCurrentProject: async (updates) => {
    const { currentProjectId, currentProject } = get();
    if (!currentProjectId || !currentProject) return;
    const updated = { ...currentProject, ...updates };
    await dbUpdateProject(currentProjectId, updates);
    set({ currentProject: updated });
  },
}));
