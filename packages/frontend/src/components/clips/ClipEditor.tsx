import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useClipStore } from '@/stores/clipStore';
import type { ClipData } from '@/types';

interface ClipEditorProps {
  clip: ClipData | null;
  onClose: () => void;
}

export function ClipEditor({ clip, onClose }: ClipEditorProps) {
  const { updateClip, addClip } = useClipStore();
  const isNew = !clip;

  const [title, setTitle] = useState(clip?.title || '');
  const [startMin, setStartMin] = useState(clip ? Math.floor(clip.start_time / 60).toString() : '0');
  const [startSec, setStartSec] = useState(clip ? Math.floor(clip.start_time % 60).toString() : '0');
  const [endMin, setEndMin] = useState(clip ? Math.floor(clip.end_time / 60).toString() : '1');
  const [endSec, setEndSec] = useState(clip ? Math.floor(clip.end_time % 60).toString() : '0');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const startTime = Number(startMin) * 60 + Number(startSec);
    const endTime = Number(endMin) * 60 + Number(endSec);
    try {
      if (isNew) {
        await addClip({ title, start_time: startTime, end_time: endTime });
      } else {
        await updateClip(clip.clip_id, { title, start_time: startTime, end_time: endTime });
      }
      onClose();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text">{isNew ? 'Add Clip' : 'Edit Clip'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-panel-light text-text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-text text-sm focus:outline-none focus:border-accent"
              placeholder="Clip title..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Start Time</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={startMin}
                  onChange={(e) => setStartMin(e.target.value)}
                  className="w-16 px-2 py-2 rounded-lg bg-input border border-border text-text text-sm text-center focus:outline-none focus:border-accent"
                  min={0}
                />
                <span className="text-text-muted">:</span>
                <input
                  type="number"
                  value={startSec}
                  onChange={(e) => setStartSec(e.target.value)}
                  className="w-16 px-2 py-2 rounded-lg bg-input border border-border text-text text-sm text-center focus:outline-none focus:border-accent"
                  min={0}
                  max={59}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">End Time</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={endMin}
                  onChange={(e) => setEndMin(e.target.value)}
                  className="w-16 px-2 py-2 rounded-lg bg-input border border-border text-text text-sm text-center focus:outline-none focus:border-accent"
                  min={0}
                />
                <span className="text-text-muted">:</span>
                <input
                  type="number"
                  value={endSec}
                  onChange={(e) => setEndSec(e.target.value)}
                  className="w-16 px-2 py-2 rounded-lg bg-input border border-border text-text text-sm text-center focus:outline-none focus:border-accent"
                  min={0}
                  max={59}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isNew ? 'Add Clip' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
