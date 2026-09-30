import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X, Check, Undo2, Redo2, RotateCcw, Save, CopyPlus, Eye, Captions, Type, Layout, Grid2X2, Search, ScanLine, Trash2 } from 'lucide-react';
import { RemotionPreview } from '@/components/player/RemotionPreview';
import { LayoutEditorModal, type Rect01 } from '@/components/edit/LayoutEditorModal';
import { useClipStore } from '@/stores/clipStore';
import { useProjectStore } from '@/stores/projectStore';
import { useStyleStore } from '@/stores/styleStore';
import { dbSaveTemplate } from '@/services/db';
import { opfsGetBlobUrl } from '@/services/opfs';
import { computeOutputDims } from '@/lib/outputDims';
import { autoTitleColors } from '@/lib/titleColors';
import { loadTemplateOverride, saveTemplateOverride, clearTemplateOverride } from '@/lib/templateOverrides';
import type { PodcastTemplate } from '@/data/premadeTemplates';
import { SUBTITLE_LOOKS, SAVED_SUBTITLE_KEY, readSubtitleLooks, type SubtitleLook } from '@/data/subtitleLooks';
import { SAVED_TITLE_KEY, readTitleLooks, type TitleLook } from '@/data/titleLooks';
import { DEFAULT_SUBTITLE_STYLE, DEFAULT_TITLE_STYLE, CAPTION_PRESETS, type CaptionPreset, type StyleConfig, type SubtitleStyle, type TitleStyle, type Template } from '@/types';
import { cn } from '@/lib/cn';
import { CaptionSwatch } from './CaptionSwatch';
import { TemplateSample } from './TemplateSample';
import { NumberControl as Num, EditorColor as Color, FontControl, Toggle, ControlGroup as Group } from './EditorControls';
import { useEditorHistory } from './useEditorHistory';
import { TitlePresetGallery } from './TitlePresetGallery';
import { TitleAdvancedControls } from './TitleAdvancedControls';
import { AdvancedSubtitleGallery } from './AdvancedSubtitleGallery';

interface Draft {
  subtitle: SubtitleStyle; title: TitleStyle; layout: PodcastTemplate['layout'];
  box: { width: number; height: number; y: number; radius: number };
  titleText: string; titleColors: number[]; regionCrops?: Rect01[]; layoutRange: { start: number; end: number } | null;
}
interface Props {
  template: PodcastTemplate; onClose: () => void; totalClips: number; onSavedTemplate?: (t: Template) => void;
  onApply: (tpl: PodcastTemplate, styles: StyleConfig, clipId: string | null, title: string, colors: number[], crops?: Rect01[], range?: { start: number; end: number } | null) => Promise<void>;
}
const panels = [{ id: 'presets', name: 'Presets', icon: Grid2X2 }, { id: 'captions', name: 'Captions', icon: Captions },
  { id: 'title', name: 'Title', icon: Type }, { id: 'layout', name: 'Layout', icon: Layout }] as const;
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-lime-300 disabled:opacity-35 disabled:cursor-not-allowed';

function useMediaUrl(id?: string | null) {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let cancelled = false; let objectUrl: string | undefined; setUrl(undefined);
    if (id) void opfsGetBlobUrl(id).then((value) => { objectUrl = value; if (cancelled) URL.revokeObjectURL(value); else setUrl(value); }).catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return url;
}

export function TemplateEditor({ template, onClose, onApply, totalClips, onSavedTemplate }: Props) {
  const project = useProjectStore((s) => s.currentProject);
  const clip = useClipStore((s) => s.clips[0]);
  const baseExport = useStyleStore((s) => s.styles.export);
  const makeSeed = (saved = true): Draft => {
    const base = template.styles();
    const override = saved && template.id !== 'custom_project' ? loadTemplateOverride(template.id) : null;
    const text = clip?.edits?.customTitle ?? clip?.title ?? 'Your story. Your style.';
    return {
      subtitle: { ...DEFAULT_SUBTITLE_STYLE, ...base.subtitle, ...override?.subtitle },
      title: { ...DEFAULT_TITLE_STYLE, ...base.title,
        ...(template.hideTitle && base.title.font_color === '#00000000' ? { font_color: '#FFFFFF' } : {}),
        enabled: base.title.enabled ?? !template.hideTitle, ...override?.title },
      layout: override?.layout ?? template.layout,
      box: override?.box ?? { width: base.export.box_width ?? 84, height: base.export.box_height ?? 52, y: base.export.box_y ?? 20, radius: base.export.box_radius ?? 40 },
      titleText: text, titleColors: clip?.edits?.titleColors ?? autoTitleColors(text),
      regionCrops: override?.regionCrops ?? (template.id === 'custom_project' ? clip?.edits?.regionCrops : undefined),
      layoutRange: override?.layoutRange ?? (template.id === 'custom_project' ? clip?.edits?.layoutRange ?? null : null),
    };
  };
  const [initial] = useState(() => makeSeed());
  const { draft: d, update, undo, redo, canUndo, canRedo } = useEditorHistory(initial);
  const [savedState, setSavedState] = useState(JSON.stringify(initial));
  const dirty = savedState !== JSON.stringify(d);
  const [panel, setPanel] = useState<typeof panels[number]['id']>('presets');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [savedLooks, setSavedLooks] = useState(readSubtitleLooks);
  const [savedTitles, setSavedTitles] = useState(readTitleLooks);
  const [lookType, setLookType] = useState<'captions' | 'titles'>('captions');
  const [name, setName] = useState('');
  const [saveMode, setSaveMode] = useState<'subtitle' | 'title' | 'template' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [comparing, setComparing] = useState(false);
  const [guides, setGuides] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const sub = (patch: Partial<SubtitleStyle>) => update((s) => ({ ...s, subtitle: { ...s.subtitle, ...patch } }), `subtitle:${Object.keys(patch).join()}`);
  const title = (patch: Partial<TitleStyle>) => update((s) => ({ ...s, title: { ...s.title, ...patch } }), `title:${Object.keys(patch).join()}`);
  const box = (patch: Partial<Draft['box']>) => update((s) => ({ ...s, box: { ...s.box, ...patch } }), `box:${Object.keys(patch).join()}`);
  const styles = useMemo<StyleConfig>(() => ({ subtitle: d.subtitle, title: d.title,
    export: { ...baseExport, box_width: d.box.width, box_height: d.box.height, box_y: d.box.y, box_radius: d.box.radius } }), [d.subtitle, d.title, d.box, baseExport]);
  const dims = computeOutputDims(styles.export, project?.video_file?.width, project?.video_file?.height);
  const videoUrl = useMediaUrl(project?.video_file?.path);
  const logoUrl = useMediaUrl(project?.logo_config?.file_id);
  const music = project?.music_tracks?.find((t) => t.selected);
  const musicUrl = useMediaUrl(music?.path);
  const split = d.layout === 'split-2h' || d.layout === 'split-2v';
  const previewStyles = comparing ? { ...styles, subtitle: DEFAULT_SUBTITLE_STYLE, title: DEFAULT_TITLE_STYLE } : styles;
  const previewClip = clip ? { ...clip, title: d.titleText, edits: { ...clip.edits, customTitle: d.titleText, titleFont: previewStyles.title.font_name, titleColors: d.titleColors } } : null;
  const looks = [...SUBTITLE_LOOKS, ...savedLooks].filter((l) => (filter === 'All' || l.category === filter) && l.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const appRoot = document.getElementById('root');
    const wasInert = appRoot?.inert ?? false;
    if (appRoot) appRoot.inert = true;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; if (appRoot) appRoot.inert = wasInert; previous?.focus(); };
  }, []);

  const persist = () => saveTemplateOverride(template.id, { subtitle: d.subtitle, title: d.title,
    preset: d.subtitle.preset ?? 'karaoke', box: d.box, regionCrops: d.regionCrops, layout: d.layout, layoutRange: d.layoutRange });
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); try { await fn(); } catch (e) { setError((e as Error).message || 'Could not save. Please try again.'); } finally { setBusy(false); } };
  const saveSettings = () => run(async () => {
    useStyleStore.getState().setStyles(styles); await useStyleStore.getState().saveStyles(); persist();
    setSavedState(JSON.stringify(d)); setMessage('Settings saved. Apply to clips to update their layout.');
  });
  const saveNamed = () => run(async () => {
    if (!name.trim()) return;
    if (saveMode === 'subtitle') {
      const next = [...savedLooks, { id: crypto.randomUUID(), name: name.trim(), category: 'Saved' as const, style: { ...d.subtitle } }];
      localStorage.setItem(SAVED_SUBTITLE_KEY, JSON.stringify(next)); setSavedLooks(next); setFilter('Saved'); setPanel('presets');
      setMessage('Subtitle preset saved to your library.');
    } else if (saveMode === 'title') {
      const next = [...savedTitles, { id: crypto.randomUUID(), name: name.trim(), category: 'Saved' as const, style: { ...d.title } }];
      localStorage.setItem(SAVED_TITLE_KEY, JSON.stringify(next)); setSavedTitles(next); setLookType('titles'); setPanel('presets');
      setMessage('Title preset saved to your library.');
    } else {
      const t: Template = { template_id: crypto.randomUUID().slice(0, 8), name: name.trim(), description: '', styles,
        layout: d.layout, region_crops: d.regionCrops, layout_range: d.layoutRange };
      await dbSaveTemplate(t); onSavedTemplate?.(t); setMessage('Template saved to your library.');
    }
    setSaveMode(null); setName('');
  });
  const chooseLook = (look: SubtitleLook) => update((s) => ({ ...s, subtitle: { ...look.style,
    margin_v: s.subtitle.margin_v, position_x: s.subtitle.position_x, max_width: s.subtitle.max_width,
  } }), `look:${look.id}`);
  const deleteLook = (id: string) => { try { const next = savedLooks.filter((l) => l.id !== id); localStorage.setItem(SAVED_SUBTITLE_KEY, JSON.stringify(next)); setSavedLooks(next); } catch { setError('Could not remove the saved preset.'); } };
  const chooseTitleLook = (look: TitleLook) => update((s) => ({ ...s, title: { ...look.style,
    position_y: s.title.position_y, position_x: s.title.position_x, max_width: s.title.max_width,
  } }), `title-look:${look.id}`);
  const deleteTitleLook = (id: string) => { try { const next = savedTitles.filter((l) => l.id !== id); localStorage.setItem(SAVED_TITLE_KEY, JSON.stringify(next)); setSavedTitles(next); } catch { setError('Could not remove the saved title preset.'); } };

  return createPortal(<div className="fixed inset-0 z-50 bg-[#171719]">
    <div ref={dialog} tabIndex={-1} role="region" aria-labelledby="template-editor-heading"
      className="template-editor w-full h-[100dvh] flex flex-col overflow-hidden bg-[#171719] outline-none"
      onKeyDown={(e) => {
        if (cropOpen) return;
        if (e.key === 'Escape') { if (saveMode) setSaveMode(null); else onClose(); }
        const typing = (e.target as HTMLElement).matches('input,textarea,select');
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        if (e.key === 'Tab') {
          const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]') ?? [])].filter((n) => n.offsetParent !== null);
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-3 min-w-0"><button onClick={onClose} aria-label="Back to Templates" className="flex items-center gap-2 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"><ArrowLeft size={18} /><span className="hidden sm:inline text-xs">Templates</span></button><span className="w-px h-7 bg-white/10" />
          <div><h2 id="template-editor-heading" className="text-sm font-semibold text-white">{template.name === 'Custom Template' ? 'Template studio' : template.name}</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Build a look that feels like you.</p></div></div>
        <div className="flex items-center gap-1.5"><span className="hidden sm:block text-[11px] text-zinc-500 mr-3">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <button className={button} onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 size={15} /></button>
          <button className={button} onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 size={15} /></button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        <section className="template-stage flex-1 min-w-0 min-h-[310px] md:min-h-0 flex flex-col bg-[#0d0d0f] relative">
          <div className="flex justify-between items-center px-5 py-3 text-[11px] text-zinc-500 shrink-0"><span className="truncate max-w-[65%]">{videoUrl && clip ? `Preview · ${clip.title}` : 'Sample preview · add a video to use your clips'}</span>
            <button onClick={() => setGuides(!guides)} aria-pressed={guides} className={cn('flex items-center gap-1.5 hover:text-white', guides && 'text-lime-300')}><ScanLine size={14} /> Guides</button></div>
          <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-3 overflow-hidden" style={{ backgroundImage: 'radial-gradient(#ffffff0a 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            <div className="template-preview relative bg-black overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10" style={{ aspectRatio: `${dims.width}/${dims.height}` }}>
              {videoUrl && previewClip ? <RemotionPreview clip={previewClip} videoSegmentUrl={videoUrl} width={dims.width} height={dims.height}
                overrideSubtitle={previewStyles.subtitle} overrideTitle={previewStyles.title} titleWordColors={d.titleColors}
                boxed={d.layout === 'boxed'} boxWidthPct={d.box.width} boxHeightPct={d.box.height} boxYPct={d.box.y} boxRadiusPx={d.box.radius}
                splitLayout={split ? d.layout as 'split-2h' | 'split-2v' : undefined} regionCrops={d.regionCrops} splitRange={d.layoutRange}
                musicSrc={musicUrl} musicVolume={music?.volume} logoSrc={logoUrl} logoX={project?.logo_config?.x} logoY={project?.logo_config?.y}
                logoSize={project?.logo_config?.size} logoOpacity={project?.logo_config?.opacity} controls autoPlay={false} loop />
                : <TemplateSample styles={previewStyles} title={d.titleText} colors={d.titleColors} layout={d.layout} width={dims.width} height={dims.height} />}
              {guides && <div className="pointer-events-none absolute inset-[8%] border border-dashed border-white/30"><div className="absolute left-1/2 inset-y-0 border-l border-dashed border-white/15" /><div className="absolute top-1/2 inset-x-0 border-t border-dashed border-white/15" /></div>}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 py-3 shrink-0">
            <button className={cn(button, comparing && 'bg-lime-300 text-black')} aria-pressed={comparing}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setComparing(true); }} onPointerUp={() => setComparing(false)} onPointerCancel={() => setComparing(false)} onLostPointerCapture={() => setComparing(false)} onBlur={() => setComparing(false)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setComparing(true); } }} onKeyUp={() => setComparing(false)}>
              <Eye size={13} />{comparing ? 'Showing default styling' : 'Hold to compare defaults'}</button>
            <p className="text-[10px] text-zinc-600">{dims.width} × {dims.height} · {comparing ? 'Release to return to your design' : 'Your current design'}</p>
          </div>
        </section>

        <aside className="w-full md:w-[410px] lg:w-[440px] md:shrink-0 border-t md:border-t-0 md:border-l border-white/[0.08] flex flex-col min-h-[400px] md:min-h-0">
          <div role="tablist" aria-label="Template controls" className="grid grid-cols-4 px-3 pt-3 shrink-0 border-b border-white/[0.08]">
            {panels.map(({ id, name, icon: Icon }) => <button role="tab" aria-selected={panel === id} aria-controls={`editor-${id}`} id={`tab-${id}`} key={id} onClick={() => setPanel(id)} className={cn('flex flex-col items-center gap-1.5 px-2 py-3 text-[11px] border-b-2 transition-colors', panel === id ? 'border-lime-300 text-lime-300' : 'border-transparent text-zinc-500 hover:text-zinc-200')}><Icon size={16} />{name}</button>)}
          </div>
          <div role="tabpanel" id={`editor-${panel}`} aria-labelledby={`tab-${panel}`} className="flex-1 md:overflow-y-auto p-5 space-y-6">
            {panel === 'presets' && <div className="grid grid-cols-2 gap-1 bg-black/20 rounded-xl p-1" aria-label="Preset type">{(['captions', 'titles'] as const).map((type) => <button key={type} aria-pressed={lookType === type} onClick={() => setLookType(type)} className={cn('py-2 rounded-lg text-xs font-medium', lookType === type ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200')}>{type === 'captions' ? 'Caption styles' : 'Title styles'}</button>)}</div>}
            {panel === 'presets' && lookType === 'titles' && <TitlePresetGallery saved={savedTitles} onChoose={chooseTitleLook} onSave={() => { setName(''); setSaveMode('title'); }} onDelete={deleteTitleLook} onCustomize={() => setPanel('title')} />}
            {panel === 'presets' && lookType === 'captions' && <>
               <div><h3 className="text-lg font-semibold text-zinc-100">Find your signature.</h3><p className="text-xs text-zinc-500 mt-1">Start with a look. Make every detail your own.</p></div>
               <AdvancedSubtitleGallery value={d.subtitle} onApply={(style) => update((s) => ({ ...s, subtitle: style }), 'advanced-subtitle-look')} />
               <label className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2"><Search size={14} className="text-zinc-500" /><input aria-label="Search subtitle styles" placeholder="Search styles…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none text-xs text-zinc-200" /></label>
              <div className="flex gap-1.5 flex-wrap">{['All', 'Bold', 'Clean', 'Color', 'Saved'].map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn('rounded-full px-3 py-1.5 text-[11px]', filter === f ? 'bg-zinc-100 text-zinc-900' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{f}</button>)}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{looks.map((look) => <div key={look.id} className="group relative min-w-0">
                <button onClick={() => chooseLook(look)} className="w-full text-left rounded-xl bg-[#222225] border border-white/[0.06] hover:border-lime-300/60 focus-visible:outline-lime-300 overflow-hidden transition-colors" aria-label={`Use ${look.name}`}>
                  <CaptionSwatch style={look.style} /><span className="block px-2 pb-2.5 text-[10px] text-zinc-400 truncate">{look.name}</span></button>
                {look.category === 'Saved' && <button onClick={() => deleteLook(look.id)} aria-label={`Delete ${look.name}`} className="absolute right-1 top-1 bg-zinc-900/90 rounded p-1 text-zinc-400 hover:text-rose-400"><Trash2 size={12} /></button>}
              </div>)}</div>
              {!looks.length && <p className="text-xs text-zinc-500 py-8 text-center">{filter === 'Saved' ? 'Save your own caption look to find it here.' : 'No matching styles. Try another name.'}</p>}
              <button className={`${button} w-full`} onClick={() => { setSaveMode('subtitle'); setName(''); }}><CopyPlus size={14} /> Save current captions as a preset</button>
              <button className="w-full text-xs text-lime-300 hover:underline" onClick={() => setPanel('captions')}>Customize font, color & effects →</button>
            </>}

            {panel === 'captions' && <>
              <Toggle label="Show captions" checked={d.subtitle.enabled !== false} onChange={(v) => sub({ enabled: v })} />
              <Group title="Typography"><FontControl value={d.subtitle.font_name} onChange={(v) => sub({ font_name: v })} />
                <div className="flex gap-2">{(['bold', 'italic'] as const).map((k) => <button key={k} aria-pressed={!!d.subtitle[k]} onClick={() => sub({ [k]: !d.subtitle[k] })} className={cn(button, d.subtitle[k] && 'bg-white/10 text-white')}>{k === 'bold' ? 'Bold' : 'Italic'}</button>)}
                  <select aria-label="Caption case" value={d.subtitle.text_case ?? 'upper'} onChange={(e) => sub({ text_case: e.target.value as SubtitleStyle['text_case'] })} className="flex-1 min-w-0 rounded-lg border border-white/10 bg-[#232326] px-2 text-xs"><option value="upper">UPPERCASE</option><option value="original">Original case</option><option value="lower">lowercase</option></select></div>
                <Num label="Font size" value={d.subtitle.font_size ?? 62} min={12} max={180} unit="px" onChange={(v) => sub({ font_size: v })} />
                <div className="grid grid-cols-2 gap-3"><Color label="Text color" value={d.subtitle.primary_color} onChange={(v) => sub({ primary_color: v })} /><Color label="Highlight" value={d.subtitle.highlight_color} onChange={(v) => sub({ highlight_color: v })} /></div>
              </Group>
              <Group title="Word highlighting"><select aria-label="Highlight animation" value={d.subtitle.preset ?? 'karaoke'} onChange={(e) => sub({ preset: e.target.value as CaptionPreset })} className="w-full p-2.5 rounded-lg bg-[#232326] border border-white/10 text-xs">{Object.entries(CAPTION_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                {d.subtitle.preset === 'box' && <Color label="Active word text" value={d.subtitle.active_text_color ?? '#FFFFFF'} onChange={(v) => sub({ active_text_color: v })} />}</Group>
              <Group title="Position & spacing">
                <Num label="Height from bottom" value={d.subtitle.margin_v ?? 120} min={0} max={dims.height - 20} unit="px" onChange={(v) => sub({ margin_v: v })} />
                <Num label="Horizontal position" value={d.subtitle.position_x ?? 50} min={0} max={100} unit="%" onChange={(v) => sub({ position_x: v })} />
                <Num label="Text width" value={d.subtitle.max_width ?? 90} min={10} max={100} unit="%" onChange={(v) => sub({ max_width: v })} />
                <select aria-label="Text alignment" value={d.subtitle.text_align ?? 'center'} onChange={(e) => sub({ text_align: e.target.value as SubtitleStyle['text_align'] })} className="w-full p-2.5 rounded-lg bg-[#232326] border border-white/10 text-xs"><option value="left">Align left</option><option value="center">Align center</option><option value="right">Align right</option></select>
                <Num label="Letter spacing" value={d.subtitle.letter_spacing ?? 0} min={-2} max={12} step={0.5} unit="px" onChange={(v) => sub({ letter_spacing: v })} />
                <Num label="Line spacing" value={d.subtitle.line_height ?? 1.3} min={0.8} max={2} step={0.05} unit="×" onChange={(v) => sub({ line_height: v })} />
                <Num label="Rotation" value={d.subtitle.rotation ?? 0} min={-30} max={30} unit="°" onChange={(v) => sub({ rotation: v })} />
              </Group>
              <Group title="Outline"><Num label="Outline thickness" value={d.subtitle.outline_width} min={0} max={16} step={0.5} unit="px" onChange={(v) => sub({ outline_width: v })} /><Color label="Outline color" value={d.subtitle.outline_color} onChange={(v) => sub({ outline_color: v })} /></Group>
              <Group title="Background"><Color label="Background color" value={d.subtitle.bg_color ?? '#111111'} onChange={(v) => sub({ bg_color: v })} />
                <Num label="Background opacity" value={Math.round((d.subtitle.bg_opacity ?? (d.subtitle.preset === 'minimal' ? 0.55 : 0)) * 100)} min={0} max={100} unit="%" onChange={(v) => sub({ bg_opacity: v / 100 })} />
                <Num label="Background padding" value={d.subtitle.bg_padding ?? 14} min={0} max={50} unit="px" onChange={(v) => sub({ bg_padding: v })} />
                <Num label="Background corners" value={d.subtitle.bg_radius ?? 8} min={0} max={50} unit="px" onChange={(v) => sub({ bg_radius: v })} />
              </Group>
              <Group title="Shadow & glow"><Color label="Shadow color" value={d.subtitle.shadow_color ?? '#000000'} onChange={(v) => sub({ shadow_color: v })} />
                <Num label="Blur / glow" value={d.subtitle.shadow_blur ?? 0} min={0} max={40} unit="px" onChange={(v) => sub({ shadow_blur: v })} />
                <Num label="Shadow horizontal" value={d.subtitle.shadow_x ?? 0} min={-20} max={20} unit="px" onChange={(v) => sub({ shadow_x: v })} />
                <Num label="Shadow vertical" value={d.subtitle.shadow_y ?? 0} min={-20} max={20} unit="px" onChange={(v) => sub({ shadow_y: v })} />
              </Group>
            </>}

            {panel === 'title' && <>
              <Toggle label="Show title" checked={d.title.enabled !== false} onChange={(v) => title({ enabled: v })} />
              <button className={`${button} w-full`} onClick={() => { setPanel('presets'); setLookType('titles'); }}><Grid2X2 size={14} /> Browse 15 title styles</button>
              <Group title="Your headline"><label className="block text-xs text-zinc-400">Title text for this clip<textarea aria-label="Title text" value={d.titleText} onChange={(e) => update((s) => ({ ...s, titleText: e.target.value, titleColors: autoTitleColors(e.target.value) }), 'title-text')} rows={3} className="mt-2 w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-white resize-y" /></label>
                <p className="text-[11px] text-zinc-500">Click a word to cycle through your three colors.</p>
                <div className="flex flex-wrap gap-1.5">{d.titleText.trim().split(/\s+/).filter(Boolean).map((w, i) => <button key={i} className="px-2 py-1 rounded-md border border-white/10 bg-black/20 text-xs font-semibold" style={{ color: [d.title.font_color, d.title.highlight_color ?? '#FFD23F', d.title.accent_color ?? '#FF4D4D'][d.titleColors[i] ?? 0] }} onClick={() => update((s) => { const colors = [...s.titleColors]; colors[i] = ((colors[i] ?? 0) + 1) % 3; return { ...s, titleColors: colors }; }, `word:${i}`)}>{w}</button>)}</div>
              </Group>
              <Group title="Appearance"><FontControl value={d.title.font_name ?? 'Inter'} onChange={(v) => title({ font_name: v })} />
                <div className="flex gap-2"><button className={cn(button, d.title.bold !== false && 'bg-white/10 text-white')} aria-pressed={d.title.bold !== false} onClick={() => title({ bold: d.title.bold === false })}>Bold</button><button className={cn(button, d.title.italic && 'bg-white/10 text-white')} aria-pressed={!!d.title.italic} onClick={() => title({ italic: !d.title.italic })}>Italic</button><select aria-label="Title case" value={d.title.text_case ?? 'original'} onChange={(e) => title({ text_case: e.target.value as TitleStyle['text_case'] })} className="flex-1 min-w-0 rounded-lg border border-white/10 bg-[#232326] px-2 text-xs"><option value="original">Original case</option><option value="upper">UPPERCASE</option><option value="lower">lowercase</option></select></div>
                <Num label="Title size" value={d.title.font_size ?? 32} min={12} max={160} unit="px" onChange={(v) => title({ font_size: v })} />
                <div className="grid grid-cols-2 gap-3"><Color label="Title color" value={d.title.font_color} onChange={(v) => title({ font_color: v })} /><Color label="Word highlight" value={d.title.highlight_color ?? '#FFD23F'} onChange={(v) => title({ highlight_color: v })} /><Color label="Accent color" value={d.title.accent_color ?? '#FF4D4D'} onChange={(v) => title({ accent_color: v })} /></div>
                <Num label="Title width" value={d.title.max_width ?? 86} min={10} max={100} unit="%" onChange={(v) => title({ max_width: v })} />
                <Num label="Title position" value={d.title.position_y ?? 8} min={0} max={100} unit="%" onChange={(v) => title({ position_y: v })} />
              </Group>
              <Group title="Title background"><Color label="Title background color" value={d.title.bg_color} onChange={(v) => title({ bg_color: v })} />
                <Num label="Title background opacity" value={Math.round(d.title.bg_opacity * 100)} min={0} max={100} unit="%" onChange={(v) => title({ bg_opacity: v / 100 })} />
                <Num label="Title padding" value={d.title.padding} min={0} max={80} unit="px" onChange={(v) => title({ padding: v })} />
                <Num label="Title corners" value={d.title.border_radius ?? 6} min={0} max={80} unit="px" onChange={(v) => title({ border_radius: v })} />
              </Group>
              <TitleAdvancedControls style={d.title} onChange={title} />
            </>}

            {panel === 'layout' && <>
              <Group title="Video layout"><div className="grid grid-cols-2 gap-2">{([{ id: 'standard', label: 'Full frame', glyph: '▯' }, { id: 'boxed', label: 'Rounded box', glyph: '▢' }, { id: 'split-2h', label: 'Stacked', glyph: '▤' }, { id: 'split-2v', label: 'Side by side', glyph: '◫' }] as const).map((l) => <button key={l.id} aria-pressed={d.layout === l.id} onClick={() => update((s) => ({ ...s, layout: l.id, regionCrops: undefined, layoutRange: null }), 'layout')} className={cn('rounded-xl border p-4 flex flex-col items-center gap-2 text-xs', d.layout === l.id ? 'bg-lime-300/5 border-lime-300/60 text-lime-300' : 'border-white/10 text-zinc-400 hover:bg-white/5')}><span className="text-3xl">{l.glyph}</span>{l.label}</button>)}</div></Group>
              {d.layout === 'boxed' && <Group title="Video box"><Num label="Box width" value={d.box.width} min={20} max={100} unit="%" onChange={(v) => box({ width: v })} /><Num label="Box height" value={d.box.height} min={20} max={100} unit="%" onChange={(v) => box({ height: v })} /><Num label="Box position" value={d.box.y} min={0} max={80} unit="%" onChange={(v) => box({ y: v })} /><Num label="Box corners" value={d.box.radius} min={0} max={160} unit="px" onChange={(v) => box({ radius: v })} /></Group>}
              {split && <Group title="Speaker framing"><p className="text-xs text-zinc-400 leading-relaxed">Choose the area of your source video shown in each region. You can also limit the split to part of the clip.</p><button className={`${button} w-full`} disabled={!videoUrl} onClick={() => setCropOpen(true)}><Layout size={14} /> Customize crop boxes</button>{!videoUrl && <p className="text-[11px] text-zinc-500">Import a video to edit its crop boxes.</p>}{d.regionCrops && <p className="text-xs text-lime-300">Custom framing is active.</p>}</Group>}
              <p className="text-xs text-zinc-500 leading-relaxed">Your project’s music and logo stay in the preview. Manage them in Import. Export format is set on the Templates page.</p>
            </>}
          </div>
        </aside>
      </div>

      {(error || message) && <p role={error ? 'alert' : 'status'} className={cn('px-5 py-2 text-xs shrink-0 border-t border-white/10', error ? 'text-rose-300' : 'text-lime-300')}>{error || message}</p>}
      {saveMode && <form className="px-5 py-3 flex items-center gap-2 bg-[#202023] border-t border-white/10 shrink-0" onSubmit={(e) => { e.preventDefault(); void saveNamed(); }}>
        <label className="text-xs text-zinc-400 shrink-0" htmlFor="preset-name">{saveMode === 'template' ? 'Template name' : 'Preset name'}</label><input id="preset-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="My signature look" className="min-w-0 flex-1 bg-black/20 rounded-lg border border-white/10 px-3 py-2 text-xs" /><button className={button} disabled={!name.trim() || busy}>Save</button><button type="button" aria-label="Cancel save" onClick={() => setSaveMode(null)}><X size={15} /></button>
      </form>}
      <footer className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-white/[0.08] shrink-0 bg-[#19191c]">
        <div className="flex gap-2"><button className={button} onClick={() => { clearTemplateOverride(template.id); update(() => makeSeed(false), 'reset'); setMessage('Reset to the starting style. Undo is available.'); }}><RotateCcw size={14} /><span className="hidden sm:inline">Reset</span></button><button className={button} disabled={busy} onClick={() => { setName(''); setSaveMode('template'); }}><CopyPlus size={14} />Save as template</button></div>
        <div className="flex gap-2"><button className={button} onClick={saveSettings} disabled={busy}><Save size={14} />Save settings</button><button disabled={busy || !totalClips} onClick={() => run(() => onApply({ ...template, layout: d.layout, hideTitle: d.title.enabled === false }, styles, clip?.clip_id ?? null, d.titleText, d.titleColors, d.regionCrops, d.layoutRange))} className="inline-flex items-center gap-2 rounded-lg bg-lime-300 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-lime-200 disabled:opacity-35 disabled:cursor-not-allowed"><Check size={15} />{busy ? 'Saving…' : `Apply to ${totalClips || 'all'} clips`}</button></div>
      </footer>
    </div>
    {split && <LayoutEditorModal open={cropOpen} layout={d.layout as 'split-2h' | 'split-2v'} videoUrl={videoUrl ?? null} previewSec={clip?.start_time ?? 0} sourceAspect={(project?.video_file?.width ?? 1280) / (project?.video_file?.height ?? 720)} outputAspect={dims.width / dims.height} initialCrops={d.regionCrops} clipDuration={clip?.duration} initialRange={d.layoutRange} onApply={(crops, range) => { update((s) => ({ ...s, regionCrops: crops, layoutRange: range }), 'crop'); setCropOpen(false); }} onClose={() => setCropOpen(false)} />}
  </div>, document.body);
}
