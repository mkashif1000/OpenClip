import { Scissors } from 'lucide-react';

export function LandingEditorShowcase() {
  return (
    <section id="editor" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/8">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-text-muted mb-3 font-mono">
          <Scissors className="w-3 h-3 text-white" />
          <span>PRECISION EDITOR</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold text-text tracking-tight mb-4">
          AI that edits with you, not just for you
        </h2>
        <p className="text-sm sm:text-base text-text-muted leading-relaxed">
          Need to tweak the output? OpenClip gives you an intuitive, non-linear timeline editor. Cut awkward sentences by clicking words in the transcript, adjust split ratios, and layer stock B-roll effortlessly.
        </p>
      </div>

      {/* Editor Mockup Window (Styled like a real app window) */}
      <div className="rounded-3xl glass-strong border border-white/15 overflow-hidden shadow-pop max-w-5xl mx-auto">
        {/* Top Window Bar */}
        <div className="px-5 py-3.5 bg-black/50 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-error/70" />
            <div className="w-3 h-3 rounded-full bg-warning/70" />
            <div className="w-3 h-3 rounded-full bg-success/70" />
            <span className="text-xs text-text-dim font-mono ml-2">OpenClip — Editor Studio</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/8 font-mono">
              Clip #02 • 38s
            </span>
          </div>
        </div>

        {/* Editor Body Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[#0a0a0e]/90">
          {/* Transcript Editor Column (Col span 5) */}
          <div className="lg:col-span-5 rounded-2xl glass-subtle border border-white/8 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/6">
                <span className="text-xs font-semibold text-text uppercase tracking-wider font-mono">
                  Interactive Transcript
                </span>
                <span className="text-[10px] text-text-dim font-mono">Click word to cut</span>
              </div>

              {/* Transcript Text with Cut Word Illustration */}
              <div className="text-xs sm:text-sm text-text-muted leading-relaxed space-y-2 font-sans">
                <p>
                  &quot;So we started building the new model, and{' '}
                  <span className="line-through text-error/60 bg-error/10 px-1 py-0.5 rounded">
                    um like basically
                  </span>{' '}
                  everything changed overnight. When you realize that the traditional workflow is broken, you can&apos;t go back.&quot;
                </p>
                <p className="text-text-dim text-[11px] pt-2">
                  ✓ Automatically cut 1.4s of filler words without desyncing audio
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between text-[11px] font-mono text-text-dim">
              <span>Word Accuracy: 99.2%</span>
              <span className="text-success">Silence Tightened</span>
            </div>
          </div>

          {/* Video Preview Column (Col span 4) */}
          <div className="lg:col-span-4 rounded-2xl glass-subtle border border-white/8 p-4 flex flex-col items-center justify-center min-h-[260px]">
            <div className="aspect-[9/16] w-36 rounded-xl bg-black border border-white/15 p-2 flex flex-col justify-between relative shadow-glow">
              <span className="text-[8px] font-mono text-text-dim text-center">9:16 PREVIEW</span>
              <div className="my-auto text-center px-1">
                <span className="text-[11px] font-extrabold text-white leading-tight uppercase">
                  &quot;EVERYTHING <span className="text-[#86FF4D]">CHANGED</span>&quot;
                </span>
              </div>
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="w-1/2 h-full bg-white" />
              </div>
            </div>
          </div>

          {/* Controls Column (Col span 3) */}
          <div className="lg:col-span-3 rounded-2xl glass-subtle border border-white/8 p-4 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-semibold text-text uppercase tracking-wider font-mono block mb-3">
                Layout &amp; Styling
              </span>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded-lg bg-white/5 border border-white/8 flex items-center justify-between">
                  <span className="text-text-muted">Preset</span>
                  <span className="font-semibold text-text">Hormozi Pop</span>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/8 flex items-center justify-between">
                  <span className="text-text-muted">Split Ratio</span>
                  <span className="font-semibold text-text">60% Top</span>
                </div>
                <div className="p-2 rounded-lg bg-white/5 border border-white/8 flex items-center justify-between">
                  <span className="text-text-muted">Smart B-Roll</span>
                  <span className="font-semibold text-success">Enabled</span>
                </div>
              </div>
            </div>

            <span className="text-[10px] text-text-dim font-mono">
              Live Remotion Player parity
            </span>
          </div>
        </div>

        {/* Timeline Bottom Strip Mockup */}
        <div className="px-6 py-4 bg-black/70 border-t border-white/8 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-text-dim">
            <span>TIMELINE TRACKS</span>
            <span>00:14.2 / 00:38.0</span>
          </div>
          {/* Multi-lane visual bar */}
          <div className="h-6 w-full rounded-lg bg-white/5 border border-white/10 relative overflow-hidden flex items-center px-2">
            <div className="h-3 w-1/4 rounded bg-white/30 mr-2" />
            <div className="h-3 w-1/3 rounded bg-accent/40 mr-2" />
            <div className="h-3 w-1/5 rounded bg-success/40" />
            {/* Playhead indicator */}
            <div className="absolute top-0 bottom-0 left-1/3 w-[2px] bg-white shadow-glow" />
          </div>
        </div>
      </div>
    </section>
  );
}
