import { useId } from 'react';
import { FONT_OPTIONS } from '@/data/fonts';

export function NumberControl({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void;
}) {
  const id = useId();
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs text-zinc-300">{label}</label>
      <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 px-2 py-1">
        <input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={value}
          onChange={(e) => { if (e.target.value !== '') onChange(Math.max(min, Math.min(max, Number(e.target.value)))); }}
          className="w-14 bg-transparent text-right text-xs text-zinc-100 outline-none" />
        <span className="text-[10px] text-zinc-500">{unit}</span>
      </div>
    </div>
    <input id={id} type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-lime-300 h-1 cursor-pointer" />
  </div>;
}

export function EditorColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return <div className="space-y-1.5 min-w-0">
    <label htmlFor={id} className="text-xs text-zinc-400">{label}</label>
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
      <input aria-label={`${label} picker`} type="color" value={/^#[\da-f]{6}/i.test(value) ? value.slice(0, 7) : '#000000'} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 bg-transparent p-0 border-0 shrink-0 cursor-pointer" />
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 w-full bg-transparent text-[11px] font-mono text-zinc-200 outline-none" />
    </div>
  </div>;
}

export function FontControl({ label = 'Font family', value, onChange }: { label?: string; value: string; onChange: (s: string) => void }) {
  const id = useId();
  const fonts = [...FONT_OPTIONS, { value: 'Courier New', label: 'Courier New', google: false }];
  return <div className="space-y-2"><label htmlFor={id} className="text-xs text-zinc-400">{label}</label>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#232326] px-3 py-2.5 text-sm text-white">
      {fonts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
    </select></div>;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 text-sm text-zinc-200 cursor-pointer">
    {label}<input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-lime-300 w-4 h-4" />
  </label>;
}

export function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-b border-white/[0.07] pb-6 last:border-0"><h3 className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">{title}</h3>{children}</section>;
}
