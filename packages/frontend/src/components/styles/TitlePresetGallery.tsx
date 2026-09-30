import { useState } from 'react';
import { CopyPlus, Search, Trash2 } from 'lucide-react';
import { TITLE_LOOKS, type TitleLook } from '@/data/titleLooks';
import { cn } from '@/lib/cn';
import { TitleSwatch } from './TitleSwatch';

export function TitlePresetGallery({ saved, onChoose, onSave, onDelete, onCustomize }: {
  saved: TitleLook[]; onChoose: (look: TitleLook) => void; onSave: () => void;
  onDelete: (id: string) => void; onCustomize: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const looks = [...TITLE_LOOKS, ...saved].filter((l) => (filter === 'All' || l.category === filter) && l.name.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div><h3 className="text-lg font-semibold text-zinc-100">Set the headline.</h3><p className="text-xs text-zinc-500 mt-1">15 title styles. Your words, your finishing touches.</p></div>
    <label className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2"><Search size={14} className="text-zinc-500" /><input aria-label="Search title styles" placeholder="Search title styles…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none text-xs text-zinc-200" /></label>
    <div className="flex gap-1.5 flex-wrap">{['All', 'Bold', 'Clean', 'Color', 'Saved'].map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn('rounded-full px-3 py-1.5 text-[11px]', filter === f ? 'bg-zinc-100 text-zinc-900' : 'bg-white/5 text-zinc-400 hover:bg-white/10')}>{f}</button>)}</div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{looks.map((look) => <div key={look.id} className="relative min-w-0">
      <button onClick={() => onChoose(look)} aria-label={`Use title style ${look.name}`} className="w-full text-left rounded-xl bg-[#222225] border border-white/[0.06] hover:border-lime-300/60 focus-visible:outline-lime-300 overflow-hidden transition-colors"><TitleSwatch style={look.style} /><span className="block px-2 pb-2.5 text-[10px] text-zinc-400 truncate">{look.name}</span></button>
      {look.category === 'Saved' && <button onClick={() => onDelete(look.id)} aria-label={`Delete title style ${look.name}`} className="absolute right-1 top-1 bg-zinc-900/90 rounded p-1 text-zinc-400 hover:text-rose-400"><Trash2 size={12} /></button>}
    </div>)}</div>
    {!looks.length && <p className="text-xs text-zinc-500 py-8 text-center">{filter === 'Saved' ? 'Save your own title look to find it here.' : 'No matching title styles.'}</p>}
    <button className="flex items-center justify-center gap-2 w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5" onClick={onSave}><CopyPlus size={14} /> Save current title as a preset</button>
    <button className="w-full text-xs text-lime-300 hover:underline" onClick={onCustomize}>Customize title text, color & effects →</button>
  </>;
}
