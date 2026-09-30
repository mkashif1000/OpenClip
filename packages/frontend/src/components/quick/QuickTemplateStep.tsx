import { Check, Copy, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PodcastTemplate } from '@/data/premadeTemplates';

export function QuickTemplateStep({
  templates,
  selectedTemplate,
  onSelect,
  applying,
  error,
}: {
  templates: PodcastTemplate[];
  selectedTemplate: string;
  onSelect: (id: string) => void;
  applying: boolean;
  error: string | null;
}) {
  const grouped = [
    { label: 'Podcast layouts', items: templates.filter((template) => template.category !== 'creator') },
    { label: 'Creator caption looks', items: templates.filter((template) => template.category === 'creator') },
  ].filter((group) => group.items.length > 0);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] text-white"><LayoutTemplate className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-white">One-click styling</p><p className="mt-1 text-xs text-text-muted">The selected look will apply to every clip in this batch.</p></div></div>
        <span className="hidden rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.13em] text-text-dim sm:inline">Preview before export</span>
      </div>

      {grouped.map((group) => (
        <div key={group.label}>
          <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-text-dim">{group.label}</p><span className="text-[10px] text-text-dim">{group.items.length} styles</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((template) => {
              const selected = selectedTemplate === template.id;
              return (
                <button key={template.id} type="button" onClick={() => onSelect(template.id)} disabled={applying} className={cn('group relative overflow-hidden rounded-2xl border p-4 text-left transition-all', selected ? 'border-white/45 bg-white/[.1] shadow-glow' : 'border-white/[.08] bg-white/[.025] hover:border-white/25 hover:bg-white/[.055]', applying && 'cursor-wait opacity-70')}>
                  <div className="mb-8 flex items-center justify-between"><span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', selected ? 'border-white/20 bg-white text-black' : 'border-white/10 bg-white/[.06] text-text-muted')}><Copy className="h-4 w-4" /></span>{selected && <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-bold text-black"><Check className="h-3 w-3" /> Selected</span>}</div>
                  <p className="text-sm font-bold text-white">{template.name}</p><p className="mt-2 min-h-10 text-xs leading-5 text-text-muted">{template.blurb}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5 text-[9px] font-semibold uppercase tracking-[.1em] text-text-dim"><span className="rounded-md border border-white/[.08] bg-white/[.03] px-1.5 py-1">{template.layout === 'standard' ? 'Vertical' : template.layout.replace('split-', 'Split ')}</span><span className="rounded-md border border-white/[.08] bg-white/[.03] px-1.5 py-1">{template.captionPreset}</span></div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && <p className="rounded-xl border border-error/25 bg-error/[.08] px-3.5 py-3 text-xs text-error">{error}</p>}
    </section>
  );
}
