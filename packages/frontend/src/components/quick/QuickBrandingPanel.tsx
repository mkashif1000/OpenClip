import { useRef, useState } from 'react';
import { Check, Image, Loader2, Music2, Plus, Trash2, Upload, Volume2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { opfsWriteFile } from '@/services/opfs';
import { dbRegisterFile } from '@/services/db';
import type { LogoConfig, Project } from '@/types';
import { useMediaUrl } from './useMediaUrl';

export function QuickBrandingPanel({ project, disabled, onBusyChange }: {
  project: Project; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const updateProject = useProjectStore((s) => s.updateCurrentProject);
  const audioInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tracks = project.music_tracks ?? [];
  const track = tracks.find((item) => item.selected);
  const logo = project.logo_config;
  const logoMedia = useMediaUrl(logo?.file_id);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setBusy(true); onBusyChange(true); setError(null);
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this change. Please try again.'); }
    finally { busyRef.current = false; setBusy(false); onBusyChange(false); }
  };

  const importFile = (file: File, type: 'music' | 'logo') => run(async () => {
    if (type === 'music' && !file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name)) {
      throw new Error('Choose an audio file (MP3, M4A, AAC, WAV, OGG, or FLAC).');
    }
    if (type === 'logo' && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      throw new Error('Choose a PNG, JPEG, or WebP logo. A transparent PNG works best.');
    }
    // A fresh ID makes replacements visible immediately and keeps the old
    // logo intact if writing the new image fails.
    const id = `${project.project_id}_${type}_${crypto.randomUUID()}`;
    await opfsWriteFile(id, file);
    await dbRegisterFile({ file_id: id, opfs_id: id, project_id: project.project_id, filename: file.name, file_type: type, size_bytes: file.size });
    if (type === 'music') {
      await updateProject({ music_tracks: [
        ...tracks.map((item) => ({ ...item, selected: false })),
        { path: id, filename: file.name, volume: 0.1, selected: true },
      ] });
    } else {
      await updateProject({ logo_config: { file_id: id, filename: file.name, x: logo?.x ?? 50, y: logo?.y ?? 85, size: logo?.size ?? 15, opacity: logo?.opacity ?? 1 } });
    }
  });

  const updateLogo = (field: 'x' | 'y' | 'size' | 'opacity', value: number) => {
    if (!logo || !Number.isFinite(value)) return;
    const max = field === 'opacity' ? 1 : field === 'size' ? 50 : 100;
    const min = field === 'size' ? 3 : 0;
    void run(() => updateProject({ logo_config: { ...logo, [field]: Math.max(min, Math.min(max, value)) } }));
  };

  return (
    <fieldset disabled={disabled || busy} className="min-w-0 space-y-4 disabled:opacity-70">
      <legend className="sr-only">Audio and logo</legend>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
        <p className="quick-kicker">Finishing touches</p>
        <span className="text-[11px] text-text-dim">Optional · applies to the batch</span>
      </div>
      <section className="quick-panel min-w-0 p-4 sm:p-5" aria-label="Background audio">
        <div className="flex items-start gap-3">
          <span className="quick-icon shrink-0"><Music2 aria-hidden="true" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">Background audio</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">One track for the batch, mixed with the original audio.</p>
          </div>
        </div>
        <div className="quick-panel-soft mt-4 flex min-w-0 items-center gap-3 p-3.5">
          <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center gap-[3px] rounded-xl bg-white/[.04]">
            {track ? [10, 19, 28, 14, 23].map((height, index) => <span key={index} className="w-[3px] rounded-full bg-[#f5f5f5]/80" style={{ height }} />) : <Music2 className="h-5 w-5 text-text-dim" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white" title={track?.filename}>{track ? track.filename : 'Let your voice lead'}</p>
            <p className="mt-1 text-[11px] leading-4 text-text-muted">{track ? 'Background track selected' : 'Original audio only. Add music for another layer.'}</p>
          </div>
          {track && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#f5f5f5]" />}
        </div>
        <label className="mt-4 block min-w-0 text-xs font-medium text-text-muted">Audio track
          <select aria-label="Background audio track" value={track?.path ?? ''} onChange={(event) => { const path = event.target.value; void run(() => updateProject({ music_tracks: tracks.map((item) => ({ ...item, selected: item.path === path })) })); }} className="quick-input mt-2 min-h-11 w-full min-w-0 rounded-xl px-3 py-2.5 text-xs text-white">
            <option value="">No background audio</option>
            {tracks.map((item) => <option key={item.path} value={item.path}>{item.filename}</option>)}
          </select>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" onClick={() => audioInput.current?.click()} className="quick-button-secondary inline-flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold sm:w-auto"><Upload aria-hidden="true" className="h-4 w-4 shrink-0" />Import background audio</button>
          <p className="text-[10px] leading-4 text-text-dim">MP3, M4A, AAC, WAV, OGG or FLAC</p>
        </div>
        <input ref={audioInput} aria-label="Import background audio" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void importFile(file, 'music'); }} />
        {track && <div className="mt-4 border-t border-white/[.08] pt-4">
          <label className="flex items-center justify-between gap-3 text-xs text-text-muted">
            <span className="min-w-0"><span className="flex items-center gap-2 font-medium text-white"><Volume2 aria-hidden="true" className="h-4 w-4 shrink-0 text-text-dim" />Background audio volume (%)</span><span className="mt-1.5 block text-[11px] leading-4">Keep it low so voices stay clear.</span></span>
            <input type="number" aria-label="Background audio volume" min={0} max={100} value={Math.round(track.volume * 100)} onChange={(event) => { const volume = Math.max(0, Math.min(100, Number(event.target.value))) / 100; void run(() => updateProject({ music_tracks: tracks.map((item) => item.path === track.path ? { ...item, volume } : item) })); }} className="quick-input min-h-11 w-20 shrink-0 rounded-xl px-3 py-2.5 text-sm tabular-nums text-white" />
          </label>
        </div>}
      </section>
      <section className="quick-panel min-w-0 p-4 sm:p-5" aria-label="Brand logo">
        <div className="flex items-start gap-3">
          <span className="quick-icon shrink-0"><Image aria-hidden="true" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">Brand logo</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">Make every clip yours. Position your logo in the live preview.</p>
          </div>
        </div>
        {logo ? <div className="quick-panel-soft mt-4 flex min-w-0 items-center gap-3 p-3.5">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 p-2" style={{ backgroundImage: 'conic-gradient(#dadada 25%, #f1f1f1 0 50%, #dadada 0 75%, #f1f1f1 0)', backgroundSize: '12px 12px' }}>
            {logoMedia.url ? <img src={logoMedia.url} alt="Current brand logo" className="max-h-full max-w-full object-contain" /> : logoMedia.error ? <Image aria-hidden="true" className="h-6 w-6 text-[#606060]" /> : <Loader2 aria-label="Loading logo" className="h-5 w-5 animate-spin text-[#606060] motion-reduce:animate-none" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white" title={logo.filename}>{logo.filename}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#f5f5f5]"><Check aria-hidden="true" className="h-3 w-3 shrink-0" />Logo added</p>
            <p className="mt-1 text-[10px] leading-4 text-text-dim">Check placement on your clip.</p>
          </div>
        </div> : <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-5 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.03]"><Image aria-hidden="true" className="h-5 w-5 text-text-muted" /></span>
          <p className="text-xs font-medium text-white">A small mark. A recognizable clip.</p>
          <p className="mt-1.5 text-[11px] leading-5 text-text-muted">PNG, JPEG or WebP. A transparent PNG works best.</p>
        </div>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => logoInput.current?.click()} className="quick-button-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold sm:flex-none">{logo ? <Upload aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />}{logo ? 'Replace logo' : 'Add logo'}</button>
          {logo && <button type="button" onClick={() => void run(() => updateProject({ logo_config: undefined }))} className="quick-button-secondary inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium text-text-muted sm:flex-none"><Trash2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Remove logo</button>}
        </div>
        <input ref={logoInput} aria-label="Import logo" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void importFile(file, 'logo'); }} />
        {logoMedia.error && <p role="alert" className="mt-3 text-xs leading-5 text-error">{logoMedia.error}</p>}
        {logo && <div className="mt-4 border-t border-white/[.08] pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-medium text-white">Position & appearance</h3><span className="text-[10px] text-text-dim">Values in %</span></div>
          <div className="grid grid-cols-2 gap-3">
          {([
            ['x', 'Logo X position', 0, 100, 1], ['y', 'Logo Y position', 0, 100, 1],
            ['size', 'Logo size', 3, 50, 1], ['opacity', 'Logo opacity', 0, 100, 100],
          ] as const).map(([field, label, min, max, scale]) => <label key={field} className="min-w-0 text-[11px] leading-5 text-text-muted">{label} (%)
            <input type="number" aria-label={label} min={min} max={max} value={Math.round((logo[field as keyof Pick<LogoConfig, 'x' | 'y' | 'size' | 'opacity'>]) * scale)} onChange={(event) => updateLogo(field, Number(event.target.value) / scale)} className="quick-input mt-1.5 min-h-11 w-full min-w-0 rounded-xl px-3 py-2.5 text-sm tabular-nums text-white" />
          </label>)}
          </div>
        </div>}
      </section>
      {busy && <p role="status" className="quick-status flex items-center gap-2 p-3 text-xs text-text-muted"><Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-[#f5f5f5] motion-reduce:animate-none" /> Saving to your project…</p>}
      {error && <p role="alert" className="rounded-xl border border-error/25 bg-error/[.08] p-3 text-xs leading-5 text-error">{error}</p>}
      <p className="px-1 text-[11px] leading-5 text-text-dim">Audio and logo changes are saved to this project immediately and included in exports.</p>
    </fieldset>
  );
}
