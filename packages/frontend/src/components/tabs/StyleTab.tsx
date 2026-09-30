import { TemplateGalleryCard } from '@/components/styles/TemplateGalleryCard';
import { TemplateEditor } from '@/components/styles/TemplateEditor';
/**
 * Templates tab — premade Podcast presets (compact tiles) + the full
 * "Build Your Own" Template Creator.
 *
 * Clicking a Podcast tile opens a drawer with a LIVE preview rendered on a
 * real clip (Remotion), where the user tunes caption style/font/size, title
 * font/size/colors, and even the previewed clip's title text + per-word
 * colors — then "Apply to All Clips" writes the style globally + the layout
 * per clip + auto-colors every clip's title.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Save, RotateCcw, ArrowDownToLine, Trash2, FileDown, Upload, Check,
  Mic, Captions, Palette,
  Pencil, CopyPlus, Copy, ClipboardPaste,
} from 'lucide-react';
import { ExportFormatPanel } from '@/components/styles/ExportFormatPanel';
import { PIPEditor, DEFAULT_CONTENT_BOX, DEFAULT_SPEAKER_BOX, DEFAULT_SPLIT_RATIO } from '@/components/pip/PIPEditor';
import { type Rect01 } from '@/components/edit/LayoutEditorModal';
import { useStyleStore } from '@/stores/styleStore';
import { useClipStore } from '@/stores/clipStore';
import { useClipTemplateStore } from '@/stores/clipTemplateStore';
import { dbGetTemplates, dbSaveTemplate, dbDeleteTemplate } from '@/services/db';
import { autoTitleColors } from '@/lib/titleColors';
import { saveTemplateOverride } from '@/lib/templateOverrides';
import type { Template, PIPConfig, CaptionPreset, ClipEdits, StyleConfig } from '@/types';
import { PODCAST_TEMPLATES, type PodcastTemplate } from '@/data/premadeTemplates';

export function StyleTab() {
  const { styles, setStyles, saveStyles, resetToDefaults } = useStyleStore();
  const clips = useClipStore((s) => s.clips);
  const updateClip = useClipStore((s) => s.updateClip);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [picked, setPicked] = useState<PodcastTemplate | null>(null);

  const [pipEnabled, setPipEnabled] = useState(false);
  const [pipConfig, setPipConfig] = useState<PIPConfig>({
    contentBox: DEFAULT_CONTENT_BOX,
    speakerBox: DEFAULT_SPEAKER_BOX,
    splitRatio: DEFAULT_SPLIT_RATIO,
  });

  useEffect(() => {
    dbGetTemplates().then(setTemplates).catch(() => {});
  }, []);

  const importInputRef = useRef<HTMLInputElement>(null);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      const tmpl: Template = {
        template_id: crypto.randomUUID().slice(0, 8),
        name: templateName.trim(), description: '', styles,
        layout: pipEnabled ? 'pip' : 'standard',
        ...(pipEnabled ? { pip_config: pipConfig } : {}),
      };
      await dbSaveTemplate(tmpl);
      setTemplates((prev) => [...prev, tmpl]);
      setSavedMsg(`Saved "${templateName.trim()}"`);
      setTemplateName('');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleLoadTemplate = (tmpl: Template) => {
    setStyles(tmpl.styles);
    if (tmpl.layout === 'pip' && tmpl.pip_config) {
      setPipEnabled(true); setPipConfig(tmpl.pip_config);
    } else {
      setPipEnabled(false);
      setPipConfig({ contentBox: DEFAULT_CONTENT_BOX, speakerBox: DEFAULT_SPEAKER_BOX, splitRatio: DEFAULT_SPLIT_RATIO });
    }
    for (const c of clips) {
      void updateClip(c.clip_id, { edits: { ...c.edits, layout: tmpl.layout ?? 'standard',
        regionCrops: tmpl.region_crops, layoutRange: tmpl.layout_range, pipConfig: tmpl.pip_config } });
      useClipTemplateStore.getState().setClipTemplate(c.clip_id, tmpl.template_id);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    await dbDeleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.template_id !== id));
  };

  const handleExportTemplate = (tmpl: Template) => {
    const { template_id: _id, ...exportData } = tmpl; void _id;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tmpl.name.replace(/[^\w-]/g, '_')}.template.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.name || !data.styles) { alert('Invalid template file'); return; }
      const tmpl: Template = {
        template_id: crypto.randomUUID().slice(0, 8),
        name: data.name, description: data.description || '',
        styles: data.styles, layout: data.layout, pip_config: data.pip_config,
        region_crops: data.region_crops, layout_range: data.layout_range,
      };
      await dbSaveTemplate(tmpl);
      setTemplates((prev) => [...prev, tmpl]);
    } catch (err: unknown) {
      alert('Failed to import template: ' + ((err as Error)?.message || 'invalid JSON'));
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  // ─── Custom editor: same drawer, seeded from current project styles ──
  const openCustomEditor = () => {
    const snapshot = JSON.parse(JSON.stringify(styles)) as StyleConfig;
    setPicked({
      id: 'custom_project',
      name: 'Custom Template',
      blurb: 'Every control unlocked — seeded from your project styles.',
      layout: (['standard', 'boxed', 'split-2h', 'split-2v'].includes(clips[0]?.edits?.layout ?? '')
        ? clips[0].edits!.layout : 'standard') as PodcastTemplate['layout'],
      captionPreset: (styles.subtitle.preset ?? 'karaoke') as CaptionPreset,
      styles: () => JSON.parse(JSON.stringify(snapshot)) as StyleConfig,
    });
  };

  // ─── Saved-template management (rename / duplicate / share code) ─────
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleRenameTemplate = async (tmpl: Template) => {
    const name = window.prompt('Template name', tmpl.name)?.trim();
    if (!name || name === tmpl.name) return;
    const updated = { ...tmpl, name };
    await dbSaveTemplate(updated);
    setTemplates((prev) => prev.map((t) => (t.template_id === tmpl.template_id ? updated : t)));
  };

  const handleDuplicateTemplate = async (tmpl: Template) => {
    const copy: Template = { ...tmpl, template_id: crypto.randomUUID().slice(0, 8), name: `${tmpl.name} copy` };
    await dbSaveTemplate(copy);
    setTemplates((prev) => [...prev, copy]);
  };

  // Share codes: "OCT1." + base64(JSON without the local id). Free to share
  // anywhere (Discord, comments) — no backend involved.
  const handleCopyCode = async (tmpl: Template) => {
    const { template_id: _id, ...rest } = tmpl; void _id;
    const code = 'OCT1.' + btoa(unescape(encodeURIComponent(JSON.stringify(rest))));
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard unavailable */ }
    setCopiedId(tmpl.template_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePasteCode = async () => {
    const raw = window.prompt('Paste a template share code (starts with OCT1.)')?.trim();
    if (!raw) return;
    try {
      const b64 = raw.startsWith('OCT1.') ? raw.slice(5) : raw;
      const data = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (!data.name || !data.styles) throw new Error('missing fields');
      const tmpl: Template = {
        template_id: crypto.randomUUID().slice(0, 8),
        name: data.name, description: data.description || '',
        styles: data.styles, layout: data.layout, pip_config: data.pip_config,
        region_crops: data.region_crops, layout_range: data.layout_range,
      };
      await dbSaveTemplate(tmpl);
      setTemplates((prev) => [...prev, tmpl]);
    } catch {
      alert('That doesn’t look like a valid template code.');
    }
  };

  /** Apply a drawer-edited template to ALL clips in the project. */
  const applyTemplate = async (
    tpl: PodcastTemplate,
    draft: StyleConfig,
    previewClipId: string | null,
    previewTitle: string,
    previewColors: number[],
    regionCrops?: Rect01[],
    layoutRange?: { start: number; end: number } | null,
  ) => {
    setStyles(draft);
    await saveStyles();

    await Promise.all(clips.map((c) => {
      const merged: ClipEdits = { ...(c.edits ?? {}), layout: tpl.layout };
      delete merged.titleFont;
      delete merged.pipConfig;
      merged.regionCrops = regionCrops;
      // Split templates carry the user's box framing + optional time window.
      if (regionCrops && regionCrops.length) merged.regionCrops = regionCrops;
      merged.layoutRange = layoutRange ?? null;
      if (c.clip_id === previewClipId) {
        // The clip the user previewed keeps their exact edits.
        merged.customTitle = previewTitle;
        merged.titleColors = previewColors;
      } else {
        // Auto-color every other clip's own title.
        merged.titleColors = autoTitleColors(c.edits?.customTitle ?? c.title);
      }
      return updateClip(c.clip_id, { edits: merged });
    }));

    // Persist the applied look as this template's override so the renderer
    // (which resolves per-clip assignments) reproduces exactly what was applied.
    saveTemplateOverride(tpl.id, {
      subtitle: draft.subtitle,
      title: draft.title,
      layout: tpl.layout,
      layoutRange: layoutRange ?? null,
      preset: draft.subtitle.preset ?? tpl.captionPreset,
      box: {
        radius: draft.export.box_radius ?? 40,
        width: draft.export.box_width ?? 84,
        height: draft.export.box_height ?? 52,
        y: draft.export.box_y ?? 20,
      },
      ...(regionCrops && regionCrops.length ? { regionCrops } : {}),
    });

    // Reflect the applied template in every clip's Process-page dropdown so the
    // user can see it there (and change it per clip) instead of a global badge.
    const ct = useClipTemplateStore.getState();
    clips.forEach((c) => ct.setClipTemplate(c.clip_id, tpl.id));
    setPicked(null);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8 space-y-7">
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 animate-rise">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-text tracking-tight mb-1.5">Templates</h2>
          <p className="text-sm text-text-muted max-w-2xl">
            Start from a premade preset or roll your own. Applying a template overwrites
            the project styles + layout for every clip — tune them per-clip in Edit afterwards.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { resetToDefaults(); setPipEnabled(false); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 glass-subtle text-text-muted hover:text-text hover:bg-white/8 text-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            onClick={() => saveStyles()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-accent-hover text-sm font-medium shadow-soft"
          >
            <Save className="w-3.5 h-3.5" /> Save as Default
          </button>
        </div>
      </div>

      {/* ─── Podcast section (compact tiles) ──────────────────────────── */}
      <section className="rounded-2xl glass p-5 animate-rise hairline-top" style={{ animationDelay: '40ms' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
            <Mic className="w-4 h-4 text-text/90" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text tracking-tight">Podcast</h3>
            <p className="text-[11px] text-text-dim">Templates tuned for short-form podcast clips. Click to preview &amp; customize.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {PODCAST_TEMPLATES.filter((t) => (t.category ?? 'podcast') === 'podcast').map((tpl, i) => (
            <TemplateGalleryCard
              key={tpl.id}
              template={tpl}
              onClick={() => setPicked(tpl)}
              style={{ animationDelay: `${80 + i * 40}ms` }}
            />
          ))}
        </div>
      </section>

      {/* ─── Creator caption styles ───────────────────────────────────── */}
      <section className="rounded-2xl glass p-5 animate-rise hairline-top" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
            <Captions className="w-4 h-4 text-text/90" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text tracking-tight">Creator Styles</h3>
            <p className="text-[11px] text-text-dim">Proven caption looks for talking-head content. Click to preview &amp; customize.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PODCAST_TEMPLATES.filter((t) => t.category === 'creator').map((tpl, i) => (
            <TemplateGalleryCard
              key={tpl.id}
              template={tpl}
              onClick={() => setPicked(tpl)}
              style={{ animationDelay: `${100 + i * 30}ms` }}
            />
          ))}
        </div>
      </section>

      {/* ─── Build Your Own ───────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-rise" style={{ animationDelay: '180ms' }}>
        <div className="lg:col-span-2 space-y-6">
          {/* Custom editor entry — the SAME drawer the premade templates use,
              seeded from the current project styles. */}
          <div className="rounded-2xl glass p-5 hairline-top flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text tracking-tight mb-1">Custom Template</h3>
              <p className="text-xs text-text-dim leading-relaxed">
                Open the full style editor — live preview on a real clip, caption presets,
                fonts, colors, sizes and positions. Seeded from your current project styles.
              </p>
            </div>
            <button
              onClick={openCustomEditor}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-accent-hover text-sm font-semibold shadow-soft shrink-0"
            >
              <Palette className="w-4 h-4" /> Open Style Editor
            </button>
          </div>
          <div className="rounded-2xl glass p-5 hairline-top"><ExportFormatPanel /></div>
          <div className="rounded-2xl glass p-5 hairline-top">
            <PIPEditor enabled={pipEnabled} onEnabledChange={setPipEnabled} config={pipConfig} onConfigChange={setPipConfig} />
          </div>
          <div className="rounded-2xl glass p-5 hairline-top space-y-3">
            <h3 className="text-sm font-semibold text-text tracking-tight">Save as Template</h3>
            <p className="text-xs text-text-dim">Saves the current settings{pipEnabled ? ' (including PIP layout)' : ''} as a reusable template.</p>
            <div className="flex gap-2">
              <input
                type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name…"
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:border-white/30"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
              />
              <button
                onClick={handleSaveTemplate} disabled={!templateName.trim() || saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-accent-hover text-sm font-medium disabled:opacity-50 shadow-soft"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
            {savedMsg && <p className="text-xs text-success">{savedMsg}</p>}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="lg:sticky lg:top-4 space-y-6">
            <div className="rounded-2xl glass p-5 hairline-top space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text tracking-tight">Saved Templates</h3>
                <div className="flex gap-1.5">
                  <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportTemplate} />
                  <button
                    onClick={handlePasteCode}
                    title="Import from a share code"
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs glass-subtle border border-white/10 text-text-muted hover:text-text hover:bg-white/8"
                  >
                    <ClipboardPaste className="w-3 h-3" /> Code
                  </button>
                  <button
                    onClick={() => importInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs glass-subtle border border-white/10 text-text-muted hover:text-text hover:bg-white/8"
                  >
                    <Upload className="w-3 h-3" /> Import
                  </button>
                </div>
              </div>
              {templates.length === 0 ? (
                <p className="text-xs text-text-dim">No saved templates yet — customize a style and hit “Save as Template”.</p>
              ) : (
                <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-0.5">
                  {templates.map((tmpl) => (
                    <SavedTemplateCard
                      key={tmpl.template_id}
                      tmpl={tmpl}
                      copied={copiedId === tmpl.template_id}
                      onLoad={() => handleLoadTemplate(tmpl)}
                      onRename={() => handleRenameTemplate(tmpl)}
                      onDuplicate={() => handleDuplicateTemplate(tmpl)}
                      onCopyCode={() => handleCopyCode(tmpl)}
                      onExport={() => handleExportTemplate(tmpl)}
                      onDelete={() => handleDeleteTemplate(tmpl.template_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {picked && (
        <TemplateEditor
          template={picked}
          onClose={() => setPicked(null)}
          onApply={applyTemplate}
          totalClips={clips.length}
          onSavedTemplate={(t) => setTemplates((prev) => [...prev, t])}
        />
      )}
    </div>
  );
}

// ─── Saved template card (mini style swatch + actions) ───────────────

function SavedTemplateCard({
  tmpl, copied, onLoad, onRename, onDuplicate, onCopyCode, onExport, onDelete,
}: {
  tmpl: Template; copied: boolean;
  onLoad: () => void; onRename: () => void; onDuplicate: () => void;
  onCopyCode: () => void; onExport: () => void; onDelete: () => void;
}) {
  const sub = tmpl.styles?.subtitle;
  return (
    <div className="rounded-xl glass-subtle border border-white/8 p-2.5 hover:border-white/15 transition-colors">
      <div className="flex items-center gap-2.5">
        {/* Mini vertical swatch reflecting the template's caption look */}
        <div className="w-9 shrink-0 aspect-[9/16] rounded-md overflow-hidden ring-1 ring-white/10 relative"
          style={{ background: 'linear-gradient(165deg, #52525b 0%, #27272a 55%, #18181b 100%)' }}>
          <div className="absolute inset-x-0.5 text-center leading-none" style={{ bottom: '16%' }}>
            <span className="text-[4px] font-extrabold" style={{ color: sub?.primary_color || '#fff' }}>AA </span>
            <span className="text-[4px] font-extrabold" style={{ color: sub?.highlight_color || '#FFFF00' }}>BB</span>
          </div>
          {tmpl.layout === 'pip' && <div className="absolute left-0.5 right-0.5 bottom-[38%] h-[28%] rounded-[2px] bg-white/25" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-text truncate">{tmpl.name}</span>
            {tmpl.layout === 'pip' && <span className="px-1 py-px text-[9px] font-semibold rounded bg-success/20 text-success shrink-0">PIP</span>}
          </div>
          <p className="text-[10px] text-text-dim truncate">
            {sub?.font_name || 'Arial'} · {sub?.preset || 'karaoke'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-0.5 mt-1.5">
        <CardAction title="Load into project styles" onClick={onLoad}><ArrowDownToLine className="w-3.5 h-3.5" /></CardAction>
        <CardAction title="Rename" onClick={onRename}><Pencil className="w-3.5 h-3.5" /></CardAction>
        <CardAction title="Duplicate" onClick={onDuplicate}><CopyPlus className="w-3.5 h-3.5" /></CardAction>
        <CardAction title="Copy share code" onClick={onCopyCode}>
          {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        </CardAction>
        <CardAction title="Export JSON file" onClick={onExport}><FileDown className="w-3.5 h-3.5" /></CardAction>
        <div className="flex-1" />
        <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-error/15 text-text-dim hover:text-error" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function CardAction({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="p-1.5 rounded-md hover:bg-white/8 text-text-muted hover:text-text">
      {children}
    </button>
  );
}

