import { Wand2, CheckCircle2 } from 'lucide-react';

const autopilotSteps = [
  {
    step: '1',
    title: 'Auto Clip Detection',
    description:
      'Transcripts are scanned for high-retention hooks, controversy markers, and punchlines, scoring clips from 0 to 100.',
    tag: 'Virality Scoring',
  },
  {
    step: '2',
    title: 'Auto Layout & Cropping',
    description:
      'Intelligent face tracking and split presets frame hosts and guests side-by-side or stacked without distortion.',
    tag: 'Dynamic Reframing',
  },
  {
    step: '3',
    title: 'Auto Captions & Export',
    description:
      'Word-accurate karaoke subtitles and titles are baked in before GPU encoding into high-FPS vertical MP4s.',
    tag: 'WebCodecs GPU Render',
  },
];

export function LandingProcess() {
  return (
    <section id="autopilot" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/8">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-text-muted mb-3 font-mono">
          <Wand2 className="w-3 h-3 text-white" />
          <span>FULL AUTOMATION</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold text-text tracking-tight mb-4">
          Your video creation process — <span className="italic font-serif">now on autopilot</span>
        </h2>
        <p className="text-sm sm:text-base text-text-muted leading-relaxed">
          From raw podcast file to a folder of edited, captioned, branded vertical clips ready for publishing.
        </p>
      </div>

      {/* 3 Step Autopilot Card Container (Styled after Reference Image) */}
      <div className="rounded-3xl glass-strong border border-white/12 p-6 sm:p-12 shadow-pop relative overflow-hidden">
        {/* Subtle background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 70%)',
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {autopilotSteps.map((item) => (
            <div key={item.step} className="flex flex-col justify-between">
              <div>
                {/* Step indicator */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-8 h-8 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center shadow-soft">
                    0{item.step}
                  </div>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-text-muted">
                    {item.tag}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-text mb-2">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Graphical mini mockup */}
              <div className="mt-6 pt-4 border-t border-white/6 flex items-center gap-2 text-xs font-mono text-text-dim">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span>Zero manual keyframing</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
