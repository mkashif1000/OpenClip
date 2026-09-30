import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { PODCAST_TEMPLATES } from '@/data/premadeTemplates';
import { dbApplyTemplate, dbGetTemplates } from '@/services/db';
import { useClipStore } from '@/stores/clipStore';
import { useClipTemplateStore } from '@/stores/clipTemplateStore';
import { useProcessingStore } from '@/stores/processingStore';
import { useProjectStore } from '@/stores/projectStore';
import { useStyleStore } from '@/stores/styleStore';
import { mergeTemplateStyle, resolveTemplateChoice, styleTemplateClip, type TemplateChoice } from '@/lib/templateSelection';
import type { Template } from '@/types';

export function ImportTemplateSelector({ choice, onSelect }: {
  choice: TemplateChoice | null;
  onSelect: (choice: TemplateChoice | null) => void;
}) {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const clips = useClipStore((s) => s.clips);
  const processing = useProcessingStore((s) => s.isProcessing);
  const [saved, setSaved] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void dbGetTemplates().then((templates) => {
      if (!cancelled) setSaved(templates);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refresh]);

  const select = (id: string) => {
    onSelect(id ? resolveTemplateChoice(id, saved) : null);
    setError(null);
    setMessage('');
  };

  const apply = async () => {
    if (!choice || !projectId || !clips.length || busy.current || processing) return;
    busy.current = true;
    setApplying(true);
    setError(null);
    setMessage('');
    const styles = mergeTemplateStyle(choice, useStyleStore.getState().styles);
    const edits = clips.map((clip) => ({ clip_id: clip.clip_id, edits: styleTemplateClip(clip, choice).edits! }));
    try {
      // Save the whole change atomically before publishing it to live stores.
      await dbApplyTemplate(projectId, styles, edits);
      if (useProjectStore.getState().currentProjectId !== projectId) return;
      useStyleStore.getState().setStyles(styles);
      const applied = new Map(edits.map((item) => [item.clip_id, item.edits]));
      useClipStore.setState((state) => ({
        clips: state.clips.map((clip) => applied.has(clip.clip_id) ? { ...clip, edits: applied.get(clip.clip_id) } : clip),
      }));
      // Old per-clip assignments must not override the newly applied styles.
      for (const clip of clips) useClipTemplateStore.getState().setClipTemplate(clip.clip_id, null);
      setMessage(`Applied ${choice.name} to ${clips.length} ${clips.length === 1 ? 'clip' : 'clips'}.`);
    } catch {
      setError('Could not save the template. Your clips were not changed. Please retry.');
    } finally {
      busy.current = false;
      setApplying(false);
    }
  };

  return (
    <div className="min-w-0 space-y-3">
      <label className="block text-xs text-text-muted">
        Preview template
        <select
          aria-label="Preview template"
          value={choice?.id ?? ''}
          onChange={(event) => select(event.target.value)}
          disabled={applying}
          className="mt-2 block w-full min-w-0 rounded-xl border border-white/10 bg-[#101014] px-3 py-2.5 text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
        >
          <option value="">Current project style</option>
          <optgroup label={`Premade templates (${PODCAST_TEMPLATES.length})`}>
            {PODCAST_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </optgroup>
          <optgroup label={`Saved templates (${saved.length})`}>
            {saved.map((template) => <option key={template.template_id} value={`saved:${template.template_id}`}>{template.name}</option>)}
            {saved.length === 0 && <option disabled>{loading ? 'Loading saved templates…' : loadError ? 'Saved templates unavailable' : 'No saved templates yet'}</option>}
          </optgroup>
        </select>
      </label>
      <p className="text-[11px] leading-5 text-text-dim">Selection updates the live preview above. Apply when ready to use this look on all loaded clips.</p>
      {loading && <p role="status" className="text-[11px] text-text-muted">Loading saved templates…</p>}
      {loadError && <p role="alert" className="text-[11px] text-warning">Could not load saved templates. Premade templates are still available.</p>}
      {!loading && !loadError && saved.length === 0 && <p className="text-[11px] text-text-dim">Save a look in the Templates tab to list it here.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void apply()} disabled={!choice || !clips.length || applying || processing}
          className="flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-black hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40">
          {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {applying ? 'Applying…' : 'Apply to all clips'}
        </button>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading || applying} aria-label="Refresh saved templates" title="Refresh saved templates"
          className="rounded-lg p-2 text-text-dim hover:bg-white/5 hover:text-white disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>
      {choice && !clips.length && <p className="text-[11px] text-text-muted">Previewing a sample. Load clips to apply this template.</p>}
      {processing && <p className="text-[11px] text-text-muted">Wait for the current export to finish before applying.</p>}
      {message && <p role="status" className="text-[11px] text-success">{message}</p>}
      {error && <p role="alert" className="text-[11px] text-error">{error}</p>}
    </div>
  );
}
