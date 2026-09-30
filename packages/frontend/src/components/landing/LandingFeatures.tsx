import { Eye, Layout, Sparkles } from 'lucide-react';

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-text-muted mb-3 font-mono">
          <Sparkles className="w-3 h-3 text-white" />
          <span>INTELLIGENT FRAMING</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold text-text tracking-tight mb-4">
          AI that understands every pixel of your video
        </h2>
        <p className="text-sm sm:text-base text-text-muted leading-relaxed">
          Never lose the speaker off-camera. Intelligent reframing and multi-speaker layouts ensure your 16:9 widescreen footage transforms into vertical content that feels shot specifically for mobile.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {/* Feature 1: Face Tracking & Reframing */}
        <div className="rounded-3xl glass-strong border border-white/10 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-5 text-white">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">
              Auto Face Centering &amp; Speaker Tracking
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Powered by on-device MediaPipe BlazeFace. The model tracks where the speaker moves, calculates a smoothed path, and dynamically pans the 9:16 crop window so the subject remains perfectly framed.
            </p>
          </div>

          {/* Visual Showcase Graphic */}
          <div className="w-full aspect-[16/10] rounded-2xl bg-[#08080c] border border-white/10 p-4 flex items-center justify-center relative overflow-hidden">
            {/* 16:9 source background mockup */}
            <div className="w-full h-full rounded-xl bg-white/[0.03] border border-dashed border-white/15 relative flex items-center justify-center">
              <span className="text-[11px] font-mono text-text-dim">16:9 Horizontal Source</span>

              {/* Dynamic 9:16 Crop Box overlaid with Face Indicator */}
              <div className="absolute top-2 bottom-2 w-28 rounded-lg border-2 border-white bg-white/5 flex flex-col items-center justify-center shadow-glow">
                <div className="w-10 h-10 rounded-full border border-dashed border-success flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-success animate-ping" />
                </div>
                <span className="text-[9px] font-mono text-success mt-1">LOCKED (99.4%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: Multi-Speaker Split Layout */}
        <div className="rounded-3xl glass-strong border border-white/10 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-5 text-white">
              <Layout className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">
              Multi-Speaker Split &amp; PIP Layouts
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              Interviews and debates shouldn&apos;t cut out the listener&apos;s reactions. OpenClip automatically splits the widescreen frame into stacked top/bottom or picture-in-picture boxes with customizable seams.
            </p>
          </div>

          {/* Visual Showcase Graphic */}
          <div className="w-full aspect-[16/10] rounded-2xl bg-[#08080c] border border-white/10 p-4 flex items-center justify-center relative overflow-hidden">
            <div className="h-full aspect-[9/16] rounded-xl border border-white/20 bg-black flex flex-col gap-1 p-1.5 shadow-pop">
              <div className="flex-1 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                <span className="text-[10px] font-mono text-text">HOST</span>
              </div>
              <div className="h-[1px] w-full bg-white/20" />
              <div className="flex-1 rounded-lg bg-white/[0.05] border border-white/8 flex items-center justify-center">
                <span className="text-[10px] font-mono text-text-dim">GUEST</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
