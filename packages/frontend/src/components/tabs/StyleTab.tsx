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
  Save, RotateCcw, ArrowDownToLine, Trash2, FileDown, Upload, X, Check,
  Mic, Type, Captions, Palette, Square as SquareIcon,
  Pencil, CopyPlus, Copy, ClipboardPaste, Eye,
} from 'lucide-react';
import { ExportFormatPanel } from '@/components/styles/ExportFormatPanel';
import { ColorInput } from '@/components/styles/ColorInput';
import { RemotionPreview } from '@/components/player/RemotionPreview';
import { PIPEditor, DEFAULT_CONTENT_BOX, DEFAULT_SPEAKER_BOX, DEFAULT_SPLIT_RATIO } from '@/components/pip/PIPEditor';
import { LayoutEditorModal, type Rect01 } from '@/components/edit/LayoutEditorModal';
import { useStyleStore } from '@/stores/styleStore';
import { useClipStore } from '@/stores/clipStore';
import { useProjectStore } from '@/stores/projectStore';
import { useClipTemplateStore } from '@/stores/clipTemplateStore';
import { dbGetTemplates, dbSaveTemplate, dbDeleteTemplate } from '@/services/db';
import { cn } from '@/lib/cn';
import { FONT_OPTIONS } from '@/data/fonts';
import { autoTitleColors } from '@/lib/titleColors';
import { computeOutputDims } from '@/lib/outputDims';
import { loadTemplateOverride, saveTemplateOverride, clearTemplateOverride } from '@/lib/templateOverrides';
import type { Template, PIPConfig, CaptionPreset, ClipEdits, SubtitleStyle, TitleStyle, StyleConfig } from '@/types';
import { CAPTION_PRESETS, DEFAULT_SUBTITLE_STYLE, DEFAULT_TITLE_STYLE } from '@/types';
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
      layout: 'standard',
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
      // Split templates carry the user's box framing + optional time window.
      if (regionCrops && regionCrops.length) merged.regionCrops = regionCrops;
      merged.layoutRange = layoutRange ?? null;
      if (tpl.hideTitle) {
        merged.customTitle = '';
        delete merged.titleColors;
      } else if (c.clip_id === previewClipId) {
        // The clip the user previewed keeps their exact edits.
        merged.customTitle = previewTitle !== c.title ? previewTitle : merged.customTitle;
        merged.titleColors = previewColors;
      } else {
        // Auto-color every other clip's own title.
        merged.titleColors = autoTitleColors(c.edits?.customTitle ?? c.title);
      }
      return updateClip(c.clip_id, { edits: merged }).catch(console.error);
    }));

    // Persist the applied look as this template's override so the renderer
    // (which resolves per-clip assignments) reproduces exactly what was applied.
    saveTemplateOverride(tpl.id, {
      subtitle: draft.subtitle,
      title: draft.title,
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
            <button
              key={tpl.id}
              onClick={() => setPicked(tpl)}
              className="flex items-center gap-3 text-left rounded-xl glass-subtle border border-white/8 hover:border-white/20 hover:bg-white/4 p-3 transition-all hover:-translate-y-0.5 animate-rise"
              style={{ animationDelay: `${80 + i * 40}ms` }}
            >
              <div className="w-[78px] shrink-0 aspect-[9/16] rounded-lg overflow-hidden ring-1 ring-white/10 relative">
                <TemplateThumbnail template={tpl} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-text mb-0.5">{tpl.name}</p>
                <p className="text-[11px] text-text-dim leading-snug">{tpl.blurb}</p>
              </div>
            </button>
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
            <button
              key={tpl.id}
              onClick={() => setPicked(tpl)}
              title={tpl.blurb}
              className="flex flex-col items-center gap-2 text-center rounded-xl glass-subtle border border-white/8 hover:border-white/20 hover:bg-white/4 p-3 transition-all hover:-translate-y-0.5 animate-rise"
              style={{ animationDelay: `${100 + i * 30}ms` }}
            >
              <div className="w-[64px] shrink-0 aspect-[9/16] rounded-lg overflow-hidden ring-1 ring-white/10 relative">
                <TemplateThumbnail template={tpl} />
              </div>
              <p className="text-[12px] font-semibold text-text leading-tight">{tpl.name}</p>
            </button>
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
        <PodcastTemplateDrawer
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

// ─── Compact tile thumbnail ──────────────────────────────────────────

/** Neutral "footage" fill that reads as a video frame but stays on-theme
 *  (monochrome zinc, soft top sheen) instead of a flat bluish gray block. */
const VIDEO_FILL: React.CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 50% 32%, rgba(255,255,255,0.18), transparent 62%), ' +
    'linear-gradient(165deg, #52525b 0%, #27272a 55%, #18181b 100%)',
};
const CAP_SHADOW = '0 1px 1.5px rgba(0,0,0,0.95)';

function TemplateThumbnail({ template }: { template: PodcastTemplate }) {
  // Clean Captions — full-bleed footage, bold karaoke caption near the bottom.
  if (template.id === 'pod_clean_captions') {
    return (
      <div className="absolute inset-0" style={VIDEO_FILL}>
        <div className="absolute inset-x-1 text-center leading-[1.05]" style={{ bottom: '12%', textShadow: CAP_SHADOW }}>
          <span className="text-[6px] font-extrabold text-white">THIS </span>
          <span className="text-[6px] font-extrabold" style={{ color: '#FFFF00' }}>CHANGES</span>
          <span className="text-[6px] font-extrabold text-white"> ALL</span>
        </div>
      </div>
    );
  }
  // Title + Captions — rounded title bar up top, karaoke caption at the bottom.
  if (template.id === 'pod_title_captions') {
    return (
      <div className="absolute inset-0" style={VIDEO_FILL}>
        <div
          className="absolute left-1 right-1 rounded-[3px] bg-black/75 px-1 py-[2px] text-center leading-[1.05]"
          style={{ top: '15%' }}
        >
          <span className="text-[5px] font-bold text-white">THE </span>
          <span className="text-[5px] font-bold" style={{ color: '#FFD23F' }}>TRUTH</span>
        </div>
        <div className="absolute inset-x-1 text-center leading-[1.05]" style={{ bottom: '12%', textShadow: CAP_SHADOW }}>
          <span className="text-[6px] font-extrabold text-white">WHY IT </span>
          <span className="text-[6px] font-extrabold" style={{ color: '#FFFF00' }}>MATTERS</span>
        </div>
      </div>
    );
  }
  // Two-Speaker Split — two stacked footage rows with a karaoke caption on the seam.
  if (template.id === 'pod_two_speaker_split') {
    return (
      <div className="absolute inset-0 bg-black">
        <div className="absolute left-0 right-0 top-0" style={{ height: '49.5%', ...VIDEO_FILL }} />
        <div className="absolute left-0 right-0 bottom-0" style={{ height: '49.5%', ...VIDEO_FILL }} />
        <div className="absolute inset-x-1 text-center leading-[1.05]" style={{ bottom: '42%', textShadow: CAP_SHADOW }}>
          <span className="text-[6px] font-extrabold text-white">THEY </span>
          <span className="text-[6px] font-extrabold" style={{ color: '#FFFF00' }}>AGREE</span>
        </div>
      </div>
    );
  }
  // Boxed Video — black backdrop, rounded inset video, multi-color title above,
  // caption below. Geometry mirrors the template defaults (88% × 45% @ 26%).
  if (template.id === 'pod_boxed_video') {
    return (
      <div className="absolute inset-0 bg-black">
        <div className="absolute left-0.5 right-0.5 text-center leading-[1.05]" style={{ top: '9%', textShadow: CAP_SHADOW }}>
          <span className="text-[5px] font-extrabold text-white">WHY IT </span>
          <span className="text-[5px] font-extrabold" style={{ color: '#FFD23F' }}>MATTERS</span>
        </div>
        <div
          className="absolute rounded-[4px] ring-1 ring-white/10"
          style={{ left: '6%', right: '6%', top: '26%', height: '45%', ...VIDEO_FILL }}
        />
        <div className="absolute inset-x-1 text-center leading-[1.05]" style={{ bottom: '10%', textShadow: CAP_SHADOW }}>
          <span className="text-[6px] font-extrabold text-white">IT </span>
          <span className="text-[6px] font-extrabold" style={{ color: '#FFD23F' }}>FEELS</span>
        </div>
      </div>
    );
  }
  // Generic fallback (creator styles + future templates): footage fill with a
  // caption line rendered in the template's OWN font/colors/preset.
  const s = template.styles();
  const sub = s.subtitle;
  const pill = sub.preset === 'box';
  const bar = sub.preset === 'minimal';
  return (
    <div className="absolute inset-0" style={VIDEO_FILL}>
      <div
        className={cn('absolute inset-x-0.5 text-center leading-[1.1]', bar && 'mx-1 rounded-[2px] bg-black/60 py-px')}
        style={{ bottom: '14%', textShadow: bar ? 'none' : CAP_SHADOW, fontFamily: sub.font_name }}
      >
        <span className="text-[6px] font-extrabold" style={{ color: sub.primary_color }}>SO </span>
        <span
          className={cn('text-[6px] font-extrabold', pill && 'rounded-[2px] px-[2px]')}
          style={pill
            ? { color: '#fff', backgroundColor: sub.highlight_color, textShadow: 'none' }
            : { color: sub.highlight_color }}
        >
          GOOD
        </span>
      </div>
    </div>
  );
}

// ─── Drawer with live preview + customize ────────────────────────────

function PodcastTemplateDrawer({
  template, onClose, onApply, totalClips, onSavedTemplate,
}: {
  template: PodcastTemplate;
  onClose: () => void;
  onApply: (tpl: PodcastTemplate, draft: StyleConfig, previewClipId: string | null, previewTitle: string, previewColors: number[], regionCrops?: Rect01[], layoutRange?: { start: number; end: number } | null) => Promise<void>;
  totalClips: number;
  /** Called when the user saves the current look as a new reusable template. */
  onSavedTemplate?: (t: Template) => void;
}) {
  const clips = useClipStore((s) => s.clips);
  const project = useProjectStore((s) => s.currentProject);
  const baseExport = useStyleStore((s) => s.styles.export);
  const setStyles = useStyleStore((s) => s.setStyles);
  const saveStyles = useStyleStore((s) => s.saveStyles);

  // Template baseline, kept so "Reset to Default" can revert drawer edits.
  const [draft] = useState<StyleConfig>(() => template.styles());
  // Seed from the user's saved cross-project override when present; otherwise
  // from the template's built-in defaults. `useSaved=false` forces defaults
  // (used by "Reset to Default").
  const seed = (useSaved = true) => {
    const saved = useSaved ? loadTemplateOverride(template.id) : null;
    if (saved) {
      return {
        sub: { ...DEFAULT_SUBTITLE_STYLE, ...saved.subtitle } as SubtitleStyle,
        title: { ...DEFAULT_TITLE_STYLE, ...saved.title } as TitleStyle,
        preset: saved.preset,
        boxRadius: saved.box.radius,
        boxWidth: saved.box.width,
        boxHeight: saved.box.height,
        boxY: saved.box.y,
        regionCrops: saved.regionCrops,
      };
    }
    return {
      sub: { ...DEFAULT_SUBTITLE_STYLE, ...draft.subtitle } as SubtitleStyle,
      title: { ...DEFAULT_TITLE_STYLE, ...draft.title } as TitleStyle,
      preset: template.captionPreset,
      boxRadius: draft.export.box_radius ?? 40,
      boxWidth: draft.export.box_width ?? 84,
      boxHeight: draft.export.box_height ?? 52,
      boxY: draft.export.box_y ?? 20,
      regionCrops: undefined as Rect01[] | undefined,
    };
  };
  const init = seed();
  const [sub, setSub] = useState<SubtitleStyle>(init.sub);
  const [title, setTitle] = useState<TitleStyle>(init.title);
  const [preset, setPreset] = useState<CaptionPreset>(init.preset);
  const [boxRadius, setBoxRadius] = useState<number>(init.boxRadius);
  const [boxWidth, setBoxWidth] = useState<number>(init.boxWidth);
  const [boxHeight, setBoxHeight] = useState<number>(init.boxHeight);
  const [boxY, setBoxY] = useState<number>(init.boxY);
  // Split-layout box framing (which part of the source shows in which box).
  const isSplit = template.layout === 'split-2h' || template.layout === 'split-2v';
  const [regionCrops, setRegionCrops] = useState<Rect01[] | undefined>(init.regionCrops);
  // Optional clip-relative window the split applies in (set in the box editor).
  const [layoutRange, setLayoutRange] = useState<{ start: number; end: number } | null>(null);
  const [boxEditorOpen, setBoxEditorOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  // Dirty tracking: compare the live edit state against the last saved seed.
  const editStateJson = () => JSON.stringify({ sub, title, preset, boxRadius, boxWidth, boxHeight, boxY, regionCrops });
  const savedJsonRef = useRef('');
  useEffect(() => { savedJsonRef.current = editStateJson(); /* initial seed */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dirty = editStateJson() !== savedJsonRef.current;
  // Hold-to-compare: temporarily previews the app defaults instead of edits.
  const [comparing, setComparing] = useState(false);

  // The clip we preview on (first clip).
  const clip = clips[0] ?? null;
  const [titleText, setTitleText] = useState(clip?.title ?? 'Your Future Self Is Pulling You Forward');
  const [titleColors, setTitleColors] = useState<number[]>(() => autoTitleColors(clip?.title ?? 'Your Future Self Is Pulling You Forward'));

  // Source video + logo + music blobs for the live preview.
  const videoFileId = project?.video_file?.path;
  const logoFileId = project?.logo_config?.file_id ?? null;
  const selectedTrack = (project?.music_tracks ?? []).find((t) => t.selected) ?? null;
  const musicFileId = selectedTrack?.path ?? null;
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const loadBlob = (id: string | null, set: (u: string | null) => void) => {
    let revoked = false; let url: string | null = null;
    (async () => {
      if (!id) { set(null); return; }
      const { opfsGetBlobUrl } = await import('@/services/opfs');
      try { url = await opfsGetBlobUrl(id); if (!revoked) set(url); } catch { if (!revoked) set(null); }
    })();
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
  };
  useEffect(() => loadBlob(videoFileId ?? null, setVideoUrl), [videoFileId]);
  useEffect(() => loadBlob(logoFileId, setLogoUrl), [logoFileId]);
  useEffect(() => loadBlob(musicFileId, setMusicUrl), [musicFileId]);

  // Preview at the ACTUAL export resolution so sizes/positions match the output.
  const outDims = computeOutputDims(
    { ...baseExport, box_radius: boxRadius },
    project?.video_file?.width,
    project?.video_file?.height,
  );

  const previewClip = clip
    ? { ...clip, title: template.hideTitle ? '' : titleText }
    : null;

  const effectiveSub: SubtitleStyle = { ...sub, preset };

  const cycleWord = (i: number) =>
    setTitleColors((cs) => {
      const next = [...cs];
      while (next.length <= i) next.push(0);
      next[i] = ((next[i] ?? 0) + 1) % 3;
      return next;
    });

  const buildDraft = (): StyleConfig => ({
    subtitle: { ...sub, preset },
    title,
    export: { ...baseExport, box_radius: boxRadius, box_width: boxWidth, box_height: boxHeight, box_y: boxY },
  });

  const handleApply = async () => {
    setApplying(true);
    await onApply(template, buildDraft(), clip?.clip_id ?? null, titleText, titleColors, regionCrops, layoutRange);
    setApplying(false);
  };

  // Save the customized style as the project default AND as a cross-project
  // override for this template, so reopening it (in any project) restores it.
  const handleSave = async () => {
    setStyles(buildDraft());
    await saveStyles();
    saveTemplateOverride(template.id, {
      subtitle: { ...sub, preset },
      title,
      preset,
      box: { radius: boxRadius, width: boxWidth, height: boxHeight, y: boxY },
      ...(regionCrops && regionCrops.length ? { regionCrops } : {}),
    });
    savedJsonRef.current = editStateJson();
    setSavedMsg('Saved — restored next time');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  // Save the current look as a NEW reusable template (shows in Saved Templates).
  const handleSaveAsTemplate = async () => {
    const name = window.prompt('Template name', template.name === 'Custom Template' ? 'My Style' : `${template.name} custom`)?.trim();
    if (!name) return;
    const tmpl: Template = {
      template_id: crypto.randomUUID().slice(0, 8),
      name, description: '', styles: buildDraft(), layout: 'standard',
    };
    await dbSaveTemplate(tmpl);
    onSavedTemplate?.(tmpl);
    setSavedMsg(`Saved template “${name}”`);
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleReset = () => {
    // Forget the saved override and revert everything to template defaults.
    clearTemplateOverride(template.id);
    const s = seed(false);
    setSub(s.sub); setTitle(s.title); setPreset(s.preset);
    setBoxRadius(s.boxRadius); setBoxWidth(s.boxWidth); setBoxHeight(s.boxHeight); setBoxY(s.boxY);
    setRegionCrops(undefined);
    savedJsonRef.current = JSON.stringify({
      sub: s.sub, title: s.title, preset: s.preset,
      boxRadius: s.boxRadius, boxWidth: s.boxWidth, boxHeight: s.boxHeight, boxY: s.boxY,
      regionCrops: undefined,
    });
    const t = clip?.title ?? 'Your Future Self Is Pulling You Forward';
    setTitleText(t); setTitleColors(autoTitleColors(t));
  };

  const titleWords = titleText.trim().split(/\s+/).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ background: 'rgba(8,8,10,0.85)', backdropFilter: 'blur(14px)' }} onClick={onClose}>
      <div className="relative w-full max-w-5xl mx-4 rounded-2xl glass-strong border border-white/15 shadow-pop animate-rise overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/8 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text">{template.name}</h3>
            <p className="text-[11px] text-text-muted">{template.blurb}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/8"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 grid md:grid-cols-2 gap-0 min-h-0 overflow-hidden">
          {/* Live preview */}
          <div className="flex flex-col items-center justify-center gap-2.5 p-5 bg-black/30 border-r border-white/8">
            {videoUrl && previewClip ? (
              <div className="h-[52vh] aspect-[9/16] rounded-lg overflow-hidden ring-1 ring-white/10 bg-black">
                <RemotionPreview
                  clip={previewClip}
                  videoSegmentUrl={videoUrl}
                  width={outDims.width}
                  height={outDims.height}
                  overrideSubtitle={comparing ? { ...DEFAULT_SUBTITLE_STYLE } : effectiveSub}
                  overrideTitle={comparing ? { ...DEFAULT_TITLE_STYLE } : title}
                  titleWordColors={template.hideTitle ? undefined : titleColors}
                  boxed={template.layout === 'boxed'}
                  boxRadiusPx={boxRadius}
                  boxWidthPct={boxWidth}
                  boxHeightPct={boxHeight}
                  boxYPct={boxY}
                  splitLayout={isSplit ? template.layout as 'split-2h' | 'split-2v' : undefined}
                  regionCrops={isSplit ? regionCrops : undefined}
                  splitRange={isSplit ? layoutRange : undefined}
                  musicSrc={musicUrl ?? undefined}
                  musicVolume={selectedTrack?.volume}
                  logoSrc={logoUrl ?? undefined}
                  logoX={project?.logo_config?.x}
                  logoY={project?.logo_config?.y}
                  logoSize={project?.logo_config?.size}
                  logoOpacity={project?.logo_config?.opacity}
                  controls
                  autoPlay
                  loop
                />
              </div>
            ) : (
              <div className="h-[52vh] aspect-[9/16] rounded-lg bg-black/40 flex items-center justify-center text-text-dim text-xs text-center px-4">
                {clips.length === 0 ? 'Load clips first to preview' : 'Loading source video…'}
              </div>
            )}
            {videoUrl && previewClip && (
              <button
                onPointerDown={() => setComparing(true)}
                onPointerUp={() => setComparing(false)}
                onPointerLeave={() => setComparing(false)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border select-none',
                  comparing ? 'bg-white text-black border-white' : 'glass-subtle text-text-muted border-white/10 hover:text-text hover:bg-white/8',
                )}
                title="Hold to preview the plain default style for comparison"
              >
                <Eye className="w-3 h-3" /> {comparing ? 'Showing defaults' : 'Hold to compare'}
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="overflow-y-auto p-5 space-y-5">
            {/* Caption style */}
            <Section icon={Captions} label="Caption Style">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CAPTION_PRESETS) as CaptionPreset[]).map((p) => (
                  <button key={p} onClick={() => setPreset(p)} title={CAPTION_PRESETS[p].description}
                    className={cn('rounded-lg border px-2.5 py-2 text-left transition-all',
                      preset === p ? 'bg-white/12 border-white/30' : 'bg-white/4 border-white/8 hover:bg-white/8')}>
                    <p className="text-[11px] font-medium text-text capitalize">{CAPTION_PRESETS[p].label}</p>
                    <p className="text-[10px] text-text-dim leading-snug">{CAPTION_PRESETS[p].description}</p>
                  </button>
                ))}
              </div>
            </Section>

            {/* Caption font + size + position */}
            <Section icon={Type} label="Captions">
              <FontSelect value={sub.font_name} onChange={(v) => setSub((s) => ({ ...s, font_name: v }))} />
              <Slider label="Caption Size" value={sub.font_size ?? 62} min={24} max={100}
                onChange={(v) => setSub((s) => ({ ...s, font_size: v }))} unit="px" />
              <Slider label="Caption Height (from bottom)" value={sub.margin_v ?? 120} min={20} max={500}
                onChange={(v) => setSub((s) => ({ ...s, margin_v: v }))} unit="px" />
              <Slider label="Caption Width" value={sub.max_width ?? 90} min={40} max={100}
                onChange={(v) => setSub((s) => ({ ...s, max_width: v }))} unit="%" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <ColorInput label="Text" value={sub.primary_color} onChange={(v) => setSub((s) => ({ ...s, primary_color: v }))} />
                  <SwatchRow colors={['#FFFFFF', '#F5F5F0', '#FFE8C2', '#0A0A0A']}
                    onPick={(v) => setSub((s) => ({ ...s, primary_color: v }))} />
                </div>
                <div>
                  <ColorInput label="Active Word" value={sub.highlight_color} onChange={(v) => setSub((s) => ({ ...s, highlight_color: v }))} />
                  <SwatchRow colors={['#FFFF00', '#86FF4D', '#00E5FF', '#FF3B30', '#FFD23F']}
                    onPick={(v) => setSub((s) => ({ ...s, highlight_color: v }))} />
                </div>
              </div>
              {/* Advanced caption controls — tucked away so the panel stays approachable */}
              <details className="group">
                <summary className="cursor-pointer list-none text-[11px] text-text-dim hover:text-text-muted select-none">
                  ▸ Advanced (outline)
                </summary>
                <div className="mt-2 space-y-3 pl-1">
                  <Slider label="Outline Width" value={sub.outline_width ?? 4} min={0} max={10}
                    onChange={(v) => setSub((s) => ({ ...s, outline_width: v }))} unit="px" />
                  <div className="grid grid-cols-2 gap-2">
                    <ColorInput label="Outline" value={sub.outline_color} onChange={(v) => setSub((s) => ({ ...s, outline_color: v }))} />
                  </div>
                </div>
              </details>
            </Section>

            {/* Speaker boxes — split templates: pick which part of the source
                shows in which box (opens the drag-and-resize crop editor). */}
            {isSplit && (
              <Section icon={SquareIcon} label="Speaker Boxes">
                <p className="text-[11px] text-text-dim leading-snug">
                  Decide which part of the screen shows in the top and bottom box.
                  Drag &amp; resize a crop box over each speaker.
                </p>
                <button
                  onClick={() => setBoxEditorOpen(true)}
                  disabled={!videoUrl}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black hover:bg-accent-hover text-xs font-medium disabled:opacity-50 shadow-soft"
                >
                  <SquareIcon className="w-3.5 h-3.5" /> Customize Boxes
                </button>
                {regionCrops && (
                  <p className="text-[10px] text-success">Custom framing set — applies to the preview and every clip.</p>
                )}
              </Section>
            )}

            {/* Boxed video corner radius — only for the Boxed Video template */}
            {template.layout === 'boxed' && (
              <Section icon={SquareIcon} label="Video Box">
                <Slider label="Box Width" value={boxWidth} min={40} max={100}
                  onChange={setBoxWidth} unit="%" />
                <Slider label="Box Height" value={boxHeight} min={20} max={92}
                  onChange={setBoxHeight} unit="%" />
                <Slider label="Box Position (top → bottom)" value={boxY} min={0} max={70}
                  onChange={setBoxY} unit="%" />
                <Slider label="Corner Radius" value={boxRadius} min={0} max={120}
                  onChange={setBoxRadius} unit="px" />
              </Section>
            )}

            {/* Title (hidden for Clean Captions) */}
            {!template.hideTitle && (
              <Section icon={Palette} label="Title">
                <div>
                  <label className="block text-[11px] text-text-muted mb-1">Title text (for this preview clip)</label>
                  <input value={titleText} onChange={(e) => { setTitleText(e.target.value); setTitleColors(autoTitleColors(e.target.value)); }}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:border-white/30" />
                </div>
                {/* Tap-to-color words */}
                <div>
                  <label className="block text-[10px] text-text-dim mb-1.5">Tap a word to cycle its color (white → highlight → accent)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {titleWords.map((w, i) => {
                      const tier = titleColors[i] ?? 0;
                      const col = tier === 1 ? title.highlight_color : tier === 2 ? title.accent_color : '#FFFFFF';
                      return (
                        <button key={i} onClick={() => cycleWord(i)}
                          className="px-1.5 py-0.5 rounded-md text-[12px] font-bold border border-white/10 bg-black/40 hover:bg-white/10"
                          style={{ color: col }}>{w}</button>
                      );
                    })}
                  </div>
                </div>
                <FontSelect value={title.font_name ?? 'Inter'} onChange={(v) => setTitle((t) => ({ ...t, font_name: v }))} />
                <Slider label="Title Size" value={title.font_size ?? 40} min={20} max={90}
                  onChange={(v) => setTitle((t) => ({ ...t, font_size: v }))} unit="px" />
                <Slider label="Title Width" value={title.max_width ?? 86} min={40} max={100}
                  onChange={(v) => setTitle((t) => ({ ...t, max_width: v }))} unit="%" />
                <Slider label="Title Position (top → bottom)" value={title.position_y ?? 8} min={0} max={100}
                  onChange={(v) => setTitle((t) => ({ ...t, position_y: v }))} unit="%" />
                <Slider label="Title Box Corners" value={title.border_radius ?? 6} min={0} max={40}
                  onChange={(v) => setTitle((t) => ({ ...t, border_radius: v }))} unit="px" />
                <div className="grid grid-cols-3 gap-2">
                  <ColorInput label="Base" value={title.font_color} onChange={(v) => setTitle((t) => ({ ...t, font_color: v }))} />
                  <ColorInput label="Highlight" value={title.highlight_color ?? '#FFD23F'} onChange={(v) => setTitle((t) => ({ ...t, highlight_color: v }))} />
                  <ColorInput label="Accent" value={title.accent_color ?? '#FF4D4D'} onChange={(v) => setTitle((t) => ({ ...t, accent_color: v }))} />
                </div>
                <details className="group">
                  <summary className="cursor-pointer list-none text-[11px] text-text-dim hover:text-text-muted select-none">
                    ▸ Advanced (background bar &amp; padding)
                  </summary>
                  <div className="mt-2 space-y-3 pl-1">
                    <Slider label="Background Opacity" value={Math.round((title.bg_opacity ?? 0.75) * 100)} min={0} max={100}
                      onChange={(v) => setTitle((t) => ({ ...t, bg_opacity: v / 100 }))} unit="%" />
                    <Slider label="Padding" value={title.padding ?? 20} min={0} max={60}
                      onChange={(v) => setTitle((t) => ({ ...t, padding: v }))} unit="px" />
                    <div className="grid grid-cols-2 gap-2">
                      <ColorInput label="Background" value={title.bg_color} onChange={(v) => setTitle((t) => ({ ...t, bg_color: v }))} />
                    </div>
                  </div>
                </details>
              </Section>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-white/8 shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={handleReset} title="Revert all changes to the template defaults"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg glass-subtle border border-white/10 text-text-muted hover:text-text hover:bg-white/8 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
            </button>
            <button onClick={handleSave} title="Save these styles as the project default (without stamping the layout onto clips)"
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg glass-subtle border text-text hover:bg-white/8 text-xs',
                dirty ? 'border-warning/50' : 'border-white/10')}>
              <Save className="w-3.5 h-3.5" /> Save Settings
              {dirty && <span className="w-1.5 h-1.5 rounded-full bg-warning" title="Unsaved changes" />}
            </button>
            <button onClick={handleSaveAsTemplate} title="Save this look as a new reusable template"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg glass-subtle border border-white/10 text-text-muted hover:text-text hover:bg-white/8 text-xs">
              <CopyPlus className="w-3.5 h-3.5" /> Save as Template
            </button>
            {savedMsg && <span className="text-[11px] text-success">{savedMsg}</span>}
            {!savedMsg && dirty && <span className="text-[11px] text-warning/80">Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg glass-subtle border border-white/10 text-text text-sm font-medium hover:bg-white/8">Cancel</button>
            <button onClick={handleApply} disabled={applying || totalClips === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black hover:bg-accent-hover text-sm font-medium disabled:opacity-50 shadow-soft">
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
              {applying ? 'Applying…' : 'Apply to All Clips'}
            </button>
          </div>
        </div>
      </div>

      {/* Drag-and-resize crop editor for split templates */}
      {isSplit && (
        <LayoutEditorModal
          open={boxEditorOpen}
          layout={template.layout as 'split-2h' | 'split-2v'}
          videoUrl={videoUrl}
          previewSec={clip?.start_time ?? 0}
          sourceAspect={
            project?.video_file?.width && project?.video_file?.height
              ? project.video_file.width / project.video_file.height
              : 16 / 9
          }
          outputAspect={outDims.width / outDims.height}
          initialCrops={regionCrops}
          clipDuration={clip?.duration}
          initialRange={layoutRange}
          onApply={(crops, range) => { setRegionCrops(crops); setLayoutRange(range); setBoxEditorOpen(false); }}
          onClose={() => setBoxEditorOpen(false)}
        />
      )}
    </div>
  );
}

function Section({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-text-muted" />
        <h4 className="text-[10px] font-semibold text-text-dim uppercase tracking-[0.15em]">{label}</h4>
      </div>
      {children}
    </div>
  );
}

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Native <option> lists inherit the control background; a translucent bg
  // renders the open list washed-out / unreadable. Force a solid dark bg +
  // white text on both the select and every option.
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ backgroundColor: '#15151c', color: '#ffffff' }}
      className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 text-xs focus:outline-none focus:border-white/30"
    >
      {FONT_OPTIONS.map((f) => (
        <option key={f.value} value={f.value} style={{ backgroundColor: '#15151c', color: '#ffffff', fontFamily: f.value }}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

function Slider({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  // Drag for coarse, click the value to type an exact number. Arrow keys nudge
  // the focused slider by 1 (native range behavior).
  const [editing, setEditing] = useState(false);
  const [draft, setDraftVal] = useState('');
  const commit = () => {
    setEditing(false);
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))));
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-text-muted">{label}</label>
        {editing ? (
          <input
            autoFocus type="number" value={draft} min={min} max={max}
            onChange={(e) => setDraftVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className="w-16 px-1 py-0 rounded bg-black/40 border border-white/20 text-[11px] text-text font-mono text-right focus:outline-none
                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <button
            onClick={() => { setDraftVal(String(value)); setEditing(true); }}
            className="text-[11px] text-text-dim font-mono hover:text-text rounded px-1 -mx-1 hover:bg-white/8"
            title="Click to type an exact value"
          >
            {value}{unit}
          </button>
        )}
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-white" />
    </div>
  );
}

/** Quick-pick color dots under a color input. */
function SwatchRow({ colors, onPick }: { colors: string[]; onPick: (v: string) => void }) {
  return (
    <div className="flex gap-1 mt-1.5">
      {colors.map((c) => (
        <button
          key={c} onClick={() => onPick(c)} title={c}
          className="w-4 h-4 rounded-full border border-white/25 hover:scale-110 transition-transform"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
