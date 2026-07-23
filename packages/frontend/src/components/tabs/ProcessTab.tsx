import { ProcessingPanel } from '@/components/processing/ProcessingPanel';
import { OutputGallery } from '@/components/processing/OutputGallery';

export function ProcessTab() {
  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8 space-y-7">
      <div className="animate-rise">
        <h2 className="text-2xl font-semibold text-text mb-1.5 tracking-tight">Process &amp; Export</h2>
        <p className="text-sm text-text-muted max-w-2xl">
          Transform your timeline into platform-ready vertical clips with AI-driven speaker tracking
          and captioning.
        </p>
      </div>

      <ProcessingPanel />

      <OutputGallery />
    </div>
  );
}
