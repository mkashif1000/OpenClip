import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { ADVANCED_SUBTITLE_LOOKS, type AdvancedSubtitleLook } from '@/data/advancedSubtitleLooks';
import { cn } from '@/lib/cn';
import { CaptionSwatch } from './CaptionSwatch';
import type { SubtitleStyle } from '@/types';

interface Props { value: SubtitleStyle; onApply: (style: SubtitleStyle) => void; }

export function AdvancedSubtitleGallery({ value, onApply }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const apply = (look: AdvancedSubtitleLook) => { setSelected(look.id); onApply({ ...value, ...look.style }); };
  return (
    <section className="space-y-3" aria-labelledby="advanced-subtitle-heading">
      <div className="flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-white" /><h3 id="advanced-subtitle-heading" className="text-sm font-semibold text-text">Advanced subtitle looks</h3></div><p className="mt-1 text-[11px] leading-5 text-text-muted">20 authored treatments mixing font families, scale, motion, glow, markers, outlines, and timing-aware emphasis.</p></div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[.04] px-2 py-1 text-[9px] font-mono text-text-dim">DUO TYPE</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {ADVANCED_SUBTITLE_LOOKS.map((look, index) => <LookCard key={look.id} look={look} index={index} selected={selected === look.id || (selected === null && value.accent_font_name === look.style.accent_font_name && value.duo_effect === look.style.duo_effect)} onApply={() => apply(look)} />)}
      </div>
    </section>
  );
}

function LookCard({ look, index, selected, onApply }: { look: AdvancedSubtitleLook; index: number; selected: boolean; onApply: () => void }) {
  const s = look.style;
  return <button onClick={onApply} className={cn('group relative overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white', selected ? 'border-white/55 bg-white/[.09] shadow-[0_0_0_1px_rgba(255,255,255,.08)]' : 'border-white/8 bg-[#17171b] hover:border-white/25')} aria-label={`Apply ${look.name}`}>
    <div className="duo-preview relative aspect-[1.48/1] overflow-hidden border-b border-white/8" style={{ animationDelay: `${(index % 6) * 120}ms` }}>
      <div className="absolute inset-0 opacity-75" style={{ background: `radial-gradient(circle at ${25 + (index * 17) % 60}% ${30 + (index * 11) % 40}%, ${s.highlight_color}33, transparent 42%), linear-gradient(135deg, #0c0c10, #1b1b21)` }} />
      <div className="absolute inset-0 flex items-center justify-center px-2"><CaptionSwatch animated style={{ ...s, font_size: 28, margin_v: 38, max_width: 92 }} /></div>
      {selected && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black"><Check className="h-3 w-3" /></span>}
    </div>
    <div className="p-2"><p className="truncate text-[10px] font-semibold text-text">{look.name}</p><p className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-text-dim">{look.description}</p></div>
  </button>;
}
