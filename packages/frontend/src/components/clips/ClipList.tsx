import { useState } from 'react';
import { Wand2, FileJson, Plus, Loader2 } from 'lucide-react';
import { useClipStore } from '@/stores/clipStore';
import { useProjectStore } from '@/stores/projectStore';
import { ClipCard } from './ClipCard';
import { ClipEditor } from './ClipEditor';
import type { ClipData } from '@/types';

export function ClipList() {
  const { clips, detectClips, loadJsonClips } = useClipStore();
  const project = useProjectStore((s) => s.currentProject);
  const [detecting, setDetecting] = useState(false);
  const [editingClip, setEditingClip] = useState<ClipData | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleDetect = async () => {
    if (!project?.srt_file?.path) return;
    setDetecting(true);
    try {
      // srt_file.path stores the OPFS file ID in the new architecture
      await detectClips(project.srt_file.path, { min_duration: 30, max_duration: 60, max_clips: 10 });
    } catch (err) {
      console.error(err);
    }
    setDetecting(false);
  };

  const handleLoadJson = async () => {
    if (!project?.json_file?.path || !project?.srt_file?.path) return;
    setDetecting(true);
    try {
      await loadJsonClips(project.json_file.path, project.srt_file.path);
    } catch (err) {
      console.error(err);
    }
    setDetecting(false);
  };

  const hasJson = !!project?.json_file;
  const hasSrt = !!project?.srt_file;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-muted uppercase">
          Clips ({clips.length})
        </span>
        <div className="flex gap-1">
          {hasSrt && (
            <button
              onClick={handleDetect}
              disabled={detecting}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              {detecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              Auto-detect
            </button>
          )}
          {hasJson && hasSrt && (
            <button
              onClick={handleLoadJson}
              disabled={detecting}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-info/10 text-info hover:bg-info/20 transition-colors disabled:opacity-50"
            >
              <FileJson className="w-3 h-3" />
              Load JSON
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {clips.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted">No clips yet</p>
            <p className="text-xs text-text-dim mt-1">
              {hasSrt ? 'Click "Auto-detect" to find viral moments' : 'Upload an SRT file first'}
            </p>
          </div>
        ) : (
          clips.map((clip) => (
            <ClipCard key={clip.clip_id} clip={clip} onEdit={setEditingClip} />
          ))
        )}
      </div>

      <div className="p-2 border-t border-border">
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border hover:border-accent/50 text-text-muted hover:text-accent text-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Clip
        </button>
      </div>

      {(editingClip || showAddForm) && (
        <ClipEditor
          clip={editingClip}
          onClose={() => { setEditingClip(null); setShowAddForm(false); }}
        />
      )}
    </div>
  );
}
