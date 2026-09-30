import { Info, Layers, Monitor, HardDrive, ArrowUpRight } from 'lucide-react';
import { ProcessingPanel } from '@/components/processing/ProcessingPanel';
import { OutputGallery } from '@/components/processing/OutputGallery';
import { useClipStore } from '@/stores/clipStore';
import { useStyleStore } from '@/stores/styleStore';
import { useProcessingStore } from '@/stores/processingStore';

export function QuickExportPanel({ onOpenAdvanced }: { onOpenAdvanced: () => void }) {
  const clips = useClipStore((s) => s.clips);
  const output = useStyleStore((s) => s.styles.export);
  const isProcessing = useProcessingStore((s) => s.isProcessing);
  const outputs = useProcessingStore((s) => s.outputBlobs);
  const rendered = clips.filter((clip) => outputs[clip.clip_id]).length;
  const duration = clips.reduce((total, clip) => total + clip.duration, 0);
  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Layers className="h-4 w-4" />} title="Clips in this batch" value={String(clips.length).padStart(2, '0')} text={`${Math.floor(duration / 60)}m ${Math.round(duration % 60)}s of selected moments`} />
        <SummaryCard icon={<Monitor className="h-4 w-4" />} title="Output size" value={`${output.width} × ${output.height}`} text="Your export settings are preserved." />
        <SummaryCard icon={<HardDrive className="h-4 w-4" />} title="Render location" value="On this device" text="Keep this tab open while rendering." />
      </div>

      <div className="quick-panel p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="quick-kicker">The final step</p><h2 className="mt-1 text-lg font-semibold text-white">Export queue</h2><p className="mt-2 text-xs leading-5 text-text-muted">Select your clips, render locally, then download the files.</p></div>
          <span className="quick-chip self-start"><span className="h-1.5 w-1.5 rounded-full bg-[#f5f5f5]" /> {isProcessing ? 'Rendering' : rendered ? `${rendered} ready to download` : 'Ready to render'}</span>
        </div>
        <ProcessingPanel compact />
      </div>

      <div className="quick-outputs"><OutputGallery /></div>

      <div className="quick-panel-soft flex flex-col gap-3 px-4 py-4 text-xs leading-5 text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-start gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Need to edit individual clips, change format, or add advanced effects?</span>
        <button type="button" onClick={onOpenAdvanced} className="quick-button-secondary shrink-0 px-3 py-2 text-xs">Open Advanced mode <ArrowUpRight className="h-4 w-4" /></button>
      </div>
    </section>
  );
}

function SummaryCard({ icon, title, value, text }: { icon: React.ReactNode; title: string; value: string; text: string }) {
  return <div className="quick-panel p-5"><div className="flex items-center justify-between gap-3 text-xs text-text-muted"><span>{title}</span><span className="text-[#f5f5f5]">{icon}</span></div><p className="mt-4 text-xl font-semibold tracking-tight text-white">{value}</p><p className="mt-2 text-xs leading-5 text-text-dim">{text}</p></div>;
}
