import { Sparkles } from 'lucide-react';
import { ProcessingPanel } from '@/components/processing/ProcessingPanel';
import { OutputGallery } from '@/components/processing/OutputGallery';
import { useTemplateStatusStore } from '@/stores/templateStatusStore';
import { getCurrentProjectId } from '@/stores/projectStore';

export function ProcessTab() {
  const projectId = getCurrentProjectId();
  const activeTemplate = useTemplateStatusStore((s) => (projectId ? s.activeByProject[projectId] : undefined));

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8 space-y-7">
      <div className="animate-rise flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text mb-1.5 tracking-tight">Process &amp; Export</h2>
          <p className="text-sm text-text-muted max-w-2xl">
            Transform your timeline into platform-ready vertical clips with AI-driven speaker tracking
            and captioning.
          </p>
        </div>
        {activeTemplate && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl glass-subtle border border-white/10 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-text/90" />
            <div className="leading-tight">
              <p className="text-[9px] uppercase tracking-[0.15em] text-text-dim font-medium">Active Template</p>
              <p className="text-[13px] text-text font-medium">{activeTemplate}</p>
            </div>
          </div>
        )}
      </div>

      <ProcessingPanel />

      <OutputGallery />
    </div>
  );
}
