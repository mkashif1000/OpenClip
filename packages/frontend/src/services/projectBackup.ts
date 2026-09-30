import type { ClipData, Project, StyleConfig } from '@/types';

export interface OpenClipBackup {
  format: 'openclip-project';
  version: 1;
  exported_at: string;
  project: { name: string; styles: StyleConfig; clips: ClipData[] };
  note: string;
}

export function makeProjectBackup(project: Project, clips: ClipData[]): OpenClipBackup {
  return {
    format: 'openclip-project',
    version: 1,
    exported_at: new Date().toISOString(),
    project: { name: project.name, styles: project.styles, clips },
    note: 'Metadata backup. Source media is intentionally not copied; re-import the original video after restoring.',
  };
}

export function downloadProjectBackup(project: Project, clips: ClipData[]): void {
  const payload = JSON.stringify(makeProjectBackup(project, clips), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'openclip-project'}.openclip.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export async function readProjectBackup(file: File): Promise<OpenClipBackup> {
  const parsed = JSON.parse(await file.text()) as Partial<OpenClipBackup>;
  if (parsed.format !== 'openclip-project' || parsed.version !== 1 || !parsed.project?.styles || !Array.isArray(parsed.project.clips)) {
    throw new Error('This is not a valid OpenClip project backup.');
  }
  return parsed as OpenClipBackup;
}
