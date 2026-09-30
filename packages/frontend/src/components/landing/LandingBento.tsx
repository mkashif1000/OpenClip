import { Type, Scissors, FolderArchive, ArrowRight } from 'lucide-react';

interface Props {
  onOpenDashboard: () => void;
}

export function LandingBento({ onOpenDashboard }: Props) {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/8">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-text-muted mb-3 font-mono">
          <span>HIGH EFFICIENCY</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold text-text tracking-tight mb-4">
          Scale your creative output without scaling overhead
        </h2>
        <p className="text-sm sm:text-base text-text-muted leading-relaxed">
          Produce a month of shorts in an afternoon without hiring an agency or paying per-minute rendering fees.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Caption Engine */}
        <div className="rounded-3xl glass-strong border border-white/10 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-6 text-white">
              <Type className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">
              Viral Caption Engine
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed mb-6">
              Eye-catching animated subtitles styled after Alex Hormozi, MrBeast, and classic neon aesthetics. Word-accurate timing that keeps viewers hooked.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#0a0a0e] border border-white/8 text-center">
            <span className="text-sm font-extrabold uppercase text-[#FFE100] tracking-wide">
              HIGHLIGHT ACTIVE WORDS
            </span>
          </div>
        </div>

        {/* Card 2: Smart Filler Cuts */}
        <div className="rounded-3xl glass-strong border border-white/10 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-6 text-white">
              <Scissors className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">
              Silence &amp; Filler Slicing
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed mb-6">
              Short-form algorithms penalize dead air. OpenClip detects pauses over 0.5s and removes &quot;um&quot;, &quot;uh&quot;, and &quot;like&quot; seamlessly.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#0a0a0e] border border-white/8 flex items-center justify-between text-xs font-mono">
            <span className="text-text-dim">Pacing Score</span>
            <span className="text-success font-semibold">+35% Faster</span>
          </div>
        </div>

        {/* Card 3: Batch ZIP Export */}
        <div className="rounded-3xl glass-strong border border-white/10 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-6 text-white">
              <FolderArchive className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">
              Instant ZIP Download
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed mb-6">
              Export 10 clips simultaneously and download them packaged in a single ZIP file created client-side in milliseconds without network bottlenecks.
            </p>
          </div>

          <button
            onClick={onOpenDashboard}
            className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-accent-hover transition-colors shadow-soft"
          >
            <span>Launch My Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
