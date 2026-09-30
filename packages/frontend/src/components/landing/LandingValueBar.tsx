import { ShieldCheck, Zap, Cpu, Infinity as InfinityIcon } from 'lucide-react';

const valueProps = [
  {
    icon: ShieldCheck,
    title: '100% In-Browser Privacy',
    detail: 'Your video never uploads to any server. All processing runs in local OPFS storage.',
  },
  {
    icon: Zap,
    title: 'Hardware Accelerated',
    detail: 'WebCodecs encodes H.264 Annex B directly on your GPU without CPU bottlenecks.',
  },
  {
    icon: Cpu,
    title: 'On-Device Whisper AI',
    detail: 'Free speech-to-text models run locally via WebGPU/WASM for word-level captions.',
  },
  {
    icon: InfinityIcon,
    title: 'Free & Unlimited',
    detail: 'Zero subscriptions, zero credit caps, and no watermarks forced onto your clips.',
  },
];

export function LandingValueBar() {
  return (
    <section className="py-12 border-y border-white/8 bg-[#09090c]/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {valueProps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 text-white">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text tracking-tight mb-1">
                    {item.title}
                  </h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
