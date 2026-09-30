import { TemplateGalleryCard, TemplateThumbnail } from '@/components/styles/TemplateGalleryCard';
import { useState } from 'react';
import { Check, FolderOpen, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Project, Template } from '@/types';
import type { PodcastTemplate } from '@/data/premadeTemplates';
import { type QuickStyleChoice } from './quickStyle';
import { QuickStylePreview } from './QuickStylePreview';
import { QuickBrandingPanel } from './QuickBrandingPanel';

export function QuickStyleStep({ project, templates, savedTemplates, selectedStyle, choice, onSelect, applying, error, onBusyChange }: {
  project: Project | null;
  templates: PodcastTemplate[];
  savedTemplates: Template[];
  selectedStyle: string;
  choice: QuickStyleChoice | null;
  onSelect: (id: string) => void;
  applying: boolean;
  error: string | null;
  onBusyChange: (busy: boolean) => void;
}) {
  const [library, setLibrary] = useState<'premade' | 'saved'>(selectedStyle.startsWith('saved:') ? 'saved' : 'premade');
  const premadeGroups = [
    { label: 'Podcast', creator: false, items: templates.filter(template => template.category !== 'creator') },
    { label: 'Creator Styles', creator: true, items: templates.filter(template => template.category === 'creator') },
  ].filter(group => group.items.length > 0);

  return (
    <section className="min-w-0 space-y-5">
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] xl:gap-6">
        <QuickStylePreview project={project} choice={choice} />
        <div className="min-w-0 space-y-5">
          <section aria-label="Template library" className="quick-panel min-w-0 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="quick-icon shrink-0"><LayoutTemplate aria-hidden="true" className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="quick-kicker">The look</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Choose a template</h2>
                <p className="mt-1 text-xs leading-5 text-text-muted">Try a look on your footage. Apply it to the batch when you’re ready.</p>
              </div>
            </div>
            <div className="quick-panel-soft my-5 grid grid-cols-2 gap-1 p-1" role="group" aria-label="Template source">
              <button type="button" aria-pressed={library === 'premade'} onClick={() => setLibrary('premade')} className={cn('min-h-11 rounded-lg px-2 py-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#f5f5f5] motion-reduce:transition-none', library === 'premade' ? 'bg-white text-[#131313] shadow-sm' : 'text-text-muted hover:bg-white/[.05] hover:text-white')}>Premade templates</button>
              <button type="button" aria-pressed={library === 'saved'} onClick={() => setLibrary('saved')} className={cn('min-h-11 rounded-lg px-2 py-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#f5f5f5] motion-reduce:transition-none', library === 'saved' ? 'bg-white text-[#131313] shadow-sm' : 'text-text-muted hover:bg-white/[.05] hover:text-white')}>Saved templates <span className="ml-0.5 opacity-70">({savedTemplates.length})</span></button>
            </div>
            <div className="space-y-6">
              {library === 'premade' && premadeGroups.map((group) => (
                <div key={group.label}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-medium text-text-muted">{group.label}</h3>
                    <span className="text-[10px] tabular-nums text-text-dim">{group.items.length} looks</span>
                  </div>
                  <div className={group.creator ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
                    {group.items.map((template) => (
                      <TemplateGalleryCard key={template.id} template={template} label={`Use ${template.name}`} selected={selectedStyle === template.id} disabled={applying} onClick={() => onSelect(template.id)} />
                    ))}
                  </div>
                </div>
              ))}
              {library === 'saved' && savedTemplates.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
                {savedTemplates.map((template) => (
                  <SavedStyleCard key={template.template_id} template={template} selected={selectedStyle === `saved:${template.template_id}`} disabled={applying} onSelect={onSelect} />
                ))}
              </div>}
              {library === 'saved' && savedTemplates.length === 0 && <div className="quick-panel-soft flex flex-col items-center px-5 py-8 text-center">
                <FolderOpen aria-hidden="true" className="mb-3 h-7 w-7 text-text-dim" />
                <p className="text-sm font-semibold text-white">Your own looks, ready to reuse</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-text-muted">No saved templates yet. Save a template in Advanced mode, then return here.</p>
              </div>}
            </div>
            <div role="status" className="quick-status mt-4 flex items-start gap-2.5 p-3">
              {choice ? <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#f5f5f5]" /> : <LayoutTemplate aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />}
              <p className="min-w-0 text-xs leading-5 text-text-muted">Selected: <span className="break-words font-semibold text-white">{choice?.name ?? 'Template unavailable'}</span><span className="block text-[11px]">{choice ? 'The live preview shows this look on your clip.' : 'Choose an available template to preview its style.'}</span></p>
            </div>
          </section>
          {project && <QuickBrandingPanel key={project.project_id} project={project} disabled={applying} onBusyChange={onBusyChange} />}
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl border border-error/25 bg-error/[.08] p-4 text-xs leading-5 text-error">{error}</p>}
    </section>
  );
}

function SavedStyleCard({ template, selected, disabled, onSelect }: {
  template: Template; selected: boolean; disabled: boolean; onSelect: (id: string) => void;
}) {
  const preview: PodcastTemplate = { id: template.template_id, name: template.name, blurb: template.description,
    layout: template.layout === 'pip' ? 'standard' : template.layout ?? 'standard', captionPreset: template.styles.subtitle.preset,
    styles: () => template.styles };
  return <button type="button" aria-label={`Use ${template.name}`} aria-pressed={selected} disabled={disabled}
    onClick={() => onSelect(`saved:${template.template_id}`)}
    className={cn('flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50', selected ? 'border-white/60 bg-white/[.08]' : 'border-white/10 bg-white/[.02] hover:border-white/25')}>
    <span aria-hidden="true" className="relative block w-9 shrink-0 aspect-[9/16] overflow-hidden rounded-md ring-1 ring-white/10"><TemplateThumbnail template={preview} /></span>
    <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-white">{template.name}</span><span className="mt-1 block text-[10px] text-text-dim">{template.styles.subtitle.font_name} · {template.styles.subtitle.preset}</span></span>
    {selected && <Check className="h-4 w-4 shrink-0 text-white" />}
  </button>;
}
