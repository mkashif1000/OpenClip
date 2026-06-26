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
} from 'lucide-react';
import { SubtitleStylePanel } from '@/components/styles/SubtitleStylePanel';
import { TitleStylePanel } from '@/components/styles/TitleStylePanel';
import { ExportFormatPanel } from '@/components/styles/ExportFormatPanel';
import { LivePreview } from '@/components/styles/LivePreview';
import { ColorInput } from '@/components/styles/ColorInput';
import { RemotionPreview } from '@/components/player/RemotionPreview';
import { PIPEditor, DEFAULT_CONTENT_BOX, DEFAULT_SPEAKER_BOX, DEFAULT_SPLIT_RATIO } from '@/components/pip/PIPEditor';
import { useStyleStore } from '@/stores/styleStore';
import { useClipStore } from '@/stores/clipStore';
import { useProjectStore, getCurrentProjectId } from '@/stores/projectStore';
import { useTemplateStatusStore } from '@/stores/templateStatusStore';
import { dbGetTemplates, dbSaveTemplate, dbDeleteTemplate } from '@/services/db';
import { cn } from '@/lib/cn';
import { FONT_OPTIONS } from '@/data/fonts';
import { autoTitleColors } from '@/lib/titleColors';
import { computeOutputDims } from '@/lib/outputDims';
import type { Template, PIPConfig, CaptionPreset, ClipEdits, SubtitleStyle, TitleStyle, StyleConfig } from '@/types';
import { CAPTION_PRESETS, DEFAULT_SUBTITLE_STYLE, DEFAULT_TITLE_STYLE } from '@/types';
import { PODCAST_TEMPLATES, type PodcastTemplate } from '@/data/podcastTemplates';

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

  /** Apply a drawer-edited template to ALL clips in the project. */
  const applyTemplate = async (
    tpl: PodcastTemplate,
    draft: StyleConfig,
    previewClipId: string | null,
    previewTitle: string,
    previewColors: number[],
  ) => {
    setStyles(draft);
    await saveStyles();

    await Promise.all(clips.map((c) => {
      const merged: ClipEdits = { ...(c.edits ?? {}), layout: tpl.layout };
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

    const pid = getCurrentProjectId();
    if (pid) useTemplateStatusStore.getState().setActive(pid, tpl.name);
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
          {PODCAST_TEMPLATES.map((tpl, i) => (
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

      {/* ─── Build Your Own ───────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-rise" style={{ animationDelay: '180ms' }}>
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl glass p-5 hairline-top"><SubtitleStylePanel /></div>
            <div className="rounded-2xl glass p-5 hairline-top"><TitleStylePanel /></div>
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
            <div className="rounded-2xl glass p-5 hairline-top"><LivePreview /></div>
            <div className="rounded-2xl glass p-5 hairline-top space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text tracking-tight">Saved Templates</h3>
                <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportTemplate} />
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs glass-subtle border border-white/10 text-text-muted hover:text-text hover:bg-white/8"
                >
                  <Upload className="w-3 h-3" /> Import
                </button>
              </div>
              {templates.length === 0 ? (
                <p className="text-xs text-text-dim">No saved templates yet</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {templates.map((tmpl) => (
                    <div key={tmpl.template_id} className="flex items-center justify-between px-3 py-2 rounded-lg glass-subtle border border-white/8">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-text truncate">{tmpl.name}</span>
                        {tmpl.layout === 'pip' && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-success/20 text-success shrink-0">PIP</span>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleLoadTemplate(tmpl)} className="p-1 rounded hover:bg-white/8 text-text-muted hover:text-text" title="Load into editor"><ArrowDownToLine className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleExportTemplate(tmpl)} className="p-1 rounded hover:bg-white/8 text-text-muted hover:text-text" title="Export JSON"><FileDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteTemplate(tmpl.template_id)} className="p-1 rounded hover:bg-error/15 text-text-muted hover:text-error" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
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
        />
      )}
    </div>
  );
}

// ─── Compact tile thumbnail ──────────────────────────────────────────

function TemplateThumbnail({ template }: { template: PodcastTemplate }) {
  if (template.id === 'pod_clean_captions') {
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-gray-700 to-gray-900">
        <div className="absolute bottom-1.5 left-1 right-1 text-center">
          <div className="text-[6px] font-extrabold leading-tight text-white">
            <span className="bg-yellow-400 text-black px-0.5 rounded">BOLD</span> CAPS
          </div>
        </div>
      </div>
    );
  }
  if (template.id === 'pod_title_captions') {
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-gray-700 to-gray-900">
        <div className="absolute top-1 left-1 right-1 bg-black/85 rounded px-0.5 py-0.5 text-center">
          <p className="text-[5px] font-bold text-white leading-tight">TITLE HERE</p>
        </div>
        <div className="absolute bottom-1.5 left-1 right-1 text-center">
          <div className="text-[6px] font-extrabold text-white"><span className="text-yellow-400">CAPS</span></div>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 bg-black">
      <div className="absolute top-0.5 left-0.5 right-0.5 text-center">
        <p className="text-[5px] font-extrabold text-white leading-tight">YOUR <span className="text-yellow-300">FUTURE</span></p>
      </div>
      <div className="absolute left-1 right-1 bg-gradient-to-b from-gray-600 to-gray-800 rounded" style={{ top: '24%', height: '50%' }} />
      <div className="absolute bottom-1.5 left-1 right-1 text-center">
        <div className="text-[6px] font-extrabold text-white"><span className="text-yellow-400">IT</span> FEELS</div>
      </div>
    </div>
  );
}

// ─── Drawer with live preview + customize ────────────────────────────

function PodcastTemplateDrawer({
  template, onClose, onApply, totalClips,
}: {
  template: PodcastTemplate;
  onClose: () => void;
  onApply: (tpl: PodcastTemplate, draft: StyleConfig, previewClipId: string | null, previewTitle: string, previewColors: number[]) => Promise<void>;
  totalClips: number;
}) {
  const clips = useClipStore((s) => s.clips);
  const project = useProjectStore((s) => s.currentProject);
  const baseExport = useStyleStore((s) => s.styles.export);
  const setStyles = useStyleStore((s) => s.setStyles);
  const saveStyles = useStyleStore((s) => s.saveStyles);

  // Template baseline, kept so "Reset to Default" can revert drawer edits.
  const [draft] = useState<StyleConfig>(() => template.styles());
  const seed = () => ({
    sub: { ...DEFAULT_SUBTITLE_STYLE, ...draft.subtitle } as SubtitleStyle,
    title: { ...DEFAULT_TITLE_STYLE, ...draft.title } as TitleStyle,
    preset: template.captionPreset,
    boxRadius: draft.export.box_radius ?? 40,
  });
  const init = seed();
  const [sub, setSub] = useState<SubtitleStyle>(init.sub);
  const [title, setTitle] = useState<TitleStyle>(init.title);
  const [preset, setPreset] = useState<CaptionPreset>(init.preset);
  const [boxRadius, setBoxRadius] = useState<number>(init.boxRadius);
  const [applying, setApplying] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

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
    export: { ...baseExport, box_radius: boxRadius },
  });

  const handleApply = async () => {
    setApplying(true);
    await onApply(template, buildDraft(), clip?.clip_id ?? null, titleText, titleColors);
    setApplying(false);
  };

  // Save the customized style as the project default (no per-clip layout stamp).
  const handleSave = async () => {
    setStyles(buildDraft());
    await saveStyles();
    setSavedMsg('Saved as project default');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleReset = () => {
    const s = seed();
    setSub(s.sub); setTitle(s.title); setPreset(s.preset); setBoxRadius(s.boxRadius);
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
          <div className="flex items-center justify-center p-5 bg-black/30 border-r border-white/8">
            {videoUrl && previewClip ? (
              <div className="h-[55vh] aspect-[9/16] rounded-lg overflow-hidden ring-1 ring-white/10 bg-black">
                <RemotionPreview
                  clip={previewClip}
                  videoSegmentUrl={videoUrl}
                  width={outDims.width}
                  height={outDims.height}
                  overrideSubtitle={effectiveSub}
                  overrideTitle={title}
                  titleWordColors={template.hideTitle ? undefined : titleColors}
                  boxed={template.layout === 'boxed'}
                  boxRadiusPx={boxRadius}
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
              <div className="h-[55vh] aspect-[9/16] rounded-lg bg-black/40 flex items-center justify-center text-text-dim text-xs text-center px-4">
                {clips.length === 0 ? 'Load clips first to preview' : 'Loading source video…'}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="overflow-y-auto p-5 space-y-5">
            {/* Caption style */}
            <Section icon={Captions} label="Caption Style">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CAPTION_PRESETS) as CaptionPreset[]).map((p) => (
                  <button key={p} onClick={() => setPreset(p)}
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
              <div className="grid grid-cols-2 gap-2">
                <ColorInput label="Text" value={sub.primary_color} onChange={(v) => setSub((s) => ({ ...s, primary_color: v }))} />
                <ColorInput label="Active Word" value={sub.highlight_color} onChange={(v) => setSub((s) => ({ ...s, highlight_color: v }))} />
              </div>
            </Section>

            {/* Boxed video corner radius — only for the Boxed Video template */}
            {template.layout === 'boxed' && (
              <Section icon={SquareIcon} label="Video Box">
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
                <Slider label="Title Position (top → bottom)" value={title.position_y ?? 8} min={0} max={100}
                  onChange={(v) => setTitle((t) => ({ ...t, position_y: v }))} unit="%" />
                <Slider label="Title Box Corners" value={title.border_radius ?? 6} min={0} max={40}
                  onChange={(v) => setTitle((t) => ({ ...t, border_radius: v }))} unit="px" />
                <div className="grid grid-cols-3 gap-2">
                  <ColorInput label="Base" value={title.font_color} onChange={(v) => setTitle((t) => ({ ...t, font_color: v }))} />
                  <ColorInput label="Highlight" value={title.highlight_color ?? '#FFD23F'} onChange={(v) => setTitle((t) => ({ ...t, highlight_color: v }))} />
                  <ColorInput label="Accent" value={title.accent_color ?? '#FF4D4D'} onChange={(v) => setTitle((t) => ({ ...t, accent_color: v }))} />
                </div>
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg glass-subtle border border-white/10 text-text hover:bg-white/8 text-xs">
              <Save className="w-3.5 h-3.5" /> Save Settings
            </button>
            {savedMsg && <span className="text-[11px] text-success">{savedMsg}</span>}
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
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-text-muted">{label}</label>
        <span className="text-[11px] text-text-dim font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-white" />
    </div>
  );
}
