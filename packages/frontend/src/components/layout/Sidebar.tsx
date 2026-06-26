import { Plus, FolderOpen, ChevronLeft, ChevronRight, Trash2, HardDrive, Pencil } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';
import { useUIStore } from '@/stores/uiStore';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { opfsGetStorageUsage } from '@/services/opfs';

export function Sidebar() {
  const { projects, currentProjectId, loadProjects, createProject, selectProject, deleteProject, renameProject } = useProjectStore();
  const setClips = useClipStore((s) => s.setClips);
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [storageInfo, setStorageInfo] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const commitRename = async () => {
    if (renamingId && draftName.trim()) {
      await renameProject(renamingId, draftName);
    }
    setRenamingId(null);
  };

  const handleShowStorage = async () => {
    const { used, quota } = await opfsGetStorageUsage();
    const usedMB = (used / (1024 * 1024)).toFixed(0);
    const quotaMB = (quota / (1024 * 1024 * 1024)).toFixed(1);
    setStorageInfo(`${usedMB} MB used / ${quotaMB} GB quota`);
  };

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleNewProject = async () => {
    const project = await createProject(`Project ${projects.length + 1}`);
    setClips(project.clips || []);
  };

  const handleSelect = async (id: string) => {
    await selectProject(id);
    const project = useProjectStore.getState().currentProject;
    if (project) setClips(project.clips || []);
  };

  if (sidebarCollapsed) {
    return (
      <div className="w-10 glass-subtle border-r border-border flex flex-col items-center pt-3 shrink-0">
        <button onClick={toggleSidebar} className="p-1.5 rounded-md hover:bg-white/5 text-text-muted">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-60 glass-subtle border-r border-border flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[10px] font-semibold text-text-dim uppercase tracking-[0.15em]">Projects</span>
        <button onClick={toggleSidebar} className="p-1 rounded-md hover:bg-white/5 text-text-muted">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {projects.map((p) => {
          const isActive = p.project_id === currentProjectId;
          return (
            <div
              key={p.project_id}
              className={cn(
                'group w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg cursor-pointer relative',
                isActive
                  ? 'bg-white/8 text-text'
                  : 'text-text-muted hover:bg-white/4 hover:text-text'
              )}
              onClick={() => handleSelect(p.project_id)}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-white"
                />
              )}
              <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
              {renamingId === p.project_id ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={commitRename}
                  className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-white/5 border border-white/30 text-xs text-text focus:outline-none"
                />
              ) : (
                <span
                  className="truncate flex-1"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(p.project_id);
                    setDraftName(p.name);
                  }}
                >
                  {p.name}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(p.project_id);
                  setDraftName(p.name);
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-text-dim hover:text-text shrink-0"
                title="Rename project"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this project?')) deleteProject(p.project_id);
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-error/20 text-text-dim hover:text-error shrink-0"
                title="Delete project"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  p.status === 'completed' ? 'bg-success' :
                  p.status === 'processing' ? 'bg-warning animate-soft-pulse' :
                  'bg-white/20'
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-border space-y-2">
        <button
          onClick={handleNewProject}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white text-black hover:bg-accent-hover text-sm font-medium shadow-soft"
        >
          <Plus className="w-4 h-4" strokeWidth={2.25} />
          New Project
        </button>
        <button
          onClick={handleShowStorage}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-white/5 text-xs"
          title="Show local browser storage usage"
        >
          <HardDrive className="w-3 h-3" />
          Storage Usage
        </button>
        {storageInfo && (
          <p className="text-[10px] text-text-dim text-center">{storageInfo}</p>
        )}
      </div>
    </div>
  );
}
