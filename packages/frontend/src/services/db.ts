/**
 * IndexedDB persistence layer using the `idb` library.
 * Stores all OpenClip project state: projects, clips, styles, templates, file registry.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Project, ClipData, StyleConfig, Template } from '@/types';
import { DEFAULT_SUBTITLE_STYLE, DEFAULT_TITLE_STYLE, DEFAULT_EXPORT } from '@/types';

const DB_NAME = 'openclip-db';
const DB_VERSION = 1;

export interface FileRegistryEntry {
  file_id: string;
  filename: string;
  file_type: 'video' | 'srt' | 'json' | 'music' | 'logo' | 'output' | 'words';
  size_bytes: number;
  opfs_id: string;       // ID used in OPFS storage
  project_id: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
}

interface OpenClipDB {
  projects: { key: string; value: Project };
  clips: { key: string; value: ClipData & { project_id: string } };
  styles: { key: string; value: { project_id: string; styles: StyleConfig } };
  templates: { key: string; value: Template };
  files: { key: string; value: FileRegistryEntry };
}

let dbPromise: Promise<IDBPDatabase<OpenClipDB>> | null = null;

function getDB(): Promise<IDBPDatabase<OpenClipDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OpenClipDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'project_id' });
        }
        if (!db.objectStoreNames.contains('clips')) {
          const clipsStore = db.createObjectStore('clips', { keyPath: 'clip_id' });
          clipsStore.createIndex('by_project', 'project_id');
        }
        if (!db.objectStoreNames.contains('styles')) {
          db.createObjectStore('styles', { keyPath: 'project_id' });
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'template_id' });
        }
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'file_id' });
          filesStore.createIndex('by_project', 'project_id');
        }
      },
    });
  }
  return dbPromise;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function dbSaveProject(project: Project): Promise<void> {
  const db = await getDB();
  // Store project without clips array (clips are stored separately)
  const projectRecord = { ...project, clips: [] };
  await db.put('projects', projectRecord);
}

export async function dbGetProject(id: string): Promise<Project | null> {
  const db = await getDB();
  const project = await db.get('projects', id);
  if (!project) return null;

  // Rehydrate clips from separate store
  const clips = await dbGetClips(id);
  const styles = await dbGetStyles(id);

  return { ...project, clips, styles };
}

export async function dbListProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAll('projects');

  // Rehydrate each project with its clips and styles
  return Promise.all(
    projects
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(async (p) => {
        const clips = await dbGetClips(p.project_id);
        const styles = await dbGetStyles(p.project_id);
        return { ...p, clips, styles };
      }),
  );
}

export async function dbDeleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'clips', 'styles', 'files'], 'readwrite');

  // Delete project
  await tx.objectStore('projects').delete(id);

  // Delete all clips for this project
  const clipsIndex = tx.objectStore('clips').index('by_project');
  const clipKeys = await clipsIndex.getAllKeys(id);
  for (const key of clipKeys) {
    await tx.objectStore('clips').delete(key);
  }

  // Delete styles
  await tx.objectStore('styles').delete(id);

  // Delete file registry entries (caller must also clean up OPFS)
  const filesIndex = tx.objectStore('files').index('by_project');
  const fileKeys = await filesIndex.getAllKeys(id);
  for (const key of fileKeys) {
    await tx.objectStore('files').delete(key);
  }

  await tx.done;
}

export async function dbUpdateProject(id: string, updates: Partial<Project>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('projects', id);
  if (!existing) return;
  await db.put('projects', { ...existing, ...updates, clips: [] });
}

// ─── Clips ────────────────────────────────────────────────────────────────────

export async function dbSaveClips(projectId: string, clips: ClipData[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('clips', 'readwrite');

  // Delete existing clips for this project first
  const index = tx.store.index('by_project');
  const existingKeys = await index.getAllKeys(projectId);
  for (const key of existingKeys) {
    await tx.store.delete(key);
  }

  // Insert new clips
  for (const clip of clips) {
    await tx.store.put({ ...clip, project_id: projectId });
  }

  await tx.done;
}

export async function dbGetClips(projectId: string): Promise<ClipData[]> {
  const db = await getDB();
  const index = db.transaction('clips', 'readonly').store.index('by_project');
  const clips = await index.getAll(projectId);
  return clips
    .map(({ project_id: _pid, ...clip }) => clip as ClipData)
    .sort((a, b) => a.index - b.index);
}

export async function dbUpdateClip(
  projectId: string,
  clipId: string,
  updates: Partial<ClipData>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('clips', clipId);
  if (!existing) return;
  await db.put('clips', { ...existing, ...updates, project_id: projectId });
}

export async function dbDeleteClip(clipId: string): Promise<void> {
  const db = await getDB();
  await db.delete('clips', clipId);
}

export async function dbAddClip(projectId: string, clip: ClipData): Promise<void> {
  const db = await getDB();
  await db.put('clips', { ...clip, project_id: projectId });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

export async function dbSaveStyles(projectId: string, styles: StyleConfig): Promise<void> {
  const db = await getDB();
  await db.put('styles', { project_id: projectId, styles });
}

export async function dbGetStyles(projectId: string): Promise<StyleConfig> {
  const db = await getDB();
  const record = await db.get('styles', projectId);
  return (
    record?.styles ?? {
      subtitle: { ...DEFAULT_SUBTITLE_STYLE },
      title: { ...DEFAULT_TITLE_STYLE },
      export: { ...DEFAULT_EXPORT },
    }
  );
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function dbSaveTemplate(template: Template): Promise<void> {
  const db = await getDB();
  await db.put('templates', template);
}

export async function dbGetTemplates(): Promise<Template[]> {
  const db = await getDB();
  return db.getAll('templates');
}

export async function dbDeleteTemplate(templateId: string): Promise<void> {
  const db = await getDB();
  await db.delete('templates', templateId);
}

// ─── File Registry ────────────────────────────────────────────────────────────

export async function dbRegisterFile(entry: FileRegistryEntry): Promise<void> {
  const db = await getDB();
  await db.put('files', entry);
}

export async function dbGetFileEntry(fileId: string): Promise<FileRegistryEntry | null> {
  const db = await getDB();
  const entry = await db.get('files', fileId);
  return entry ?? null;
}

export async function dbGetProjectFiles(projectId: string): Promise<FileRegistryEntry[]> {
  const db = await getDB();
  const index = db.transaction('files', 'readonly').store.index('by_project');
  return index.getAll(projectId);
}

export async function dbDeleteFileEntry(fileId: string): Promise<void> {
  const db = await getDB();
  await db.delete('files', fileId);
}
