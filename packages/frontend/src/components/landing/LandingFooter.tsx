import { ArrowRight, Github, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

interface Props {
  onOpenDashboard: () => void;
}

export function LandingFooter({ onOpenDashboard }: Props) {
  return (
    <footer className="border-t border-white/8 bg-[#060608] pt-16 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">
        {/* Top CTA Banner in Footer */}
        <div className="rounded-3xl glass-strong border border-white/12 p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-pop text-center sm:text-left">
          <div className="max-w-xl">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight mb-2">
              Ready to create viral clips 10x faster?
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              No sign-up. No credit cards. No server uploads. Open the dashboard and start clipping in seconds.
            </p>
          </div>

          <button
            onClick={onOpenDashboard}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white text-black font-bold text-sm hover:bg-accent-hover transition-all shadow-glow hover:shadow-pop hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <span>Launch My Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Footer Meta Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-4">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <BrandLogo />
            <p className="text-xs text-text-muted leading-relaxed max-w-sm">
              An open-source, local-first AI video clipping studio powered by WebCodecs, WebGPU, and modern browser APIs.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/8 text-[11px] font-mono text-text-dim">
              <ShieldCheck className="w-3.5 h-3.5 text-success" />
              <span>Zero server telemetry • 100% private</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-text uppercase tracking-wider font-mono block">
              Navigation
            </span>
            <ul className="space-y-2 text-xs text-text-muted">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  AI Framing &amp; Tracking
                </a>
              </li>
              <li>
                <a href="#autopilot" className="hover:text-white transition-colors">
                  Autopilot Workflow
                </a>
              </li>
              <li>
                <a href="#editor" className="hover:text-white transition-colors">
                  Precision Editor
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  Frequently Asked Questions
                </a>
              </li>
            </ul>
          </div>

          {/* Community & Code */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-text uppercase tracking-wider font-mono block">
              Community
            </span>
            <ul className="space-y-2 text-xs text-text-muted">
              <li>
                <a
                  href="https://github.com/mkashif1000/OpenClip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
              <li>
                <button
                  onClick={onOpenDashboard}
                  className="hover:text-white transition-colors text-left"
                >
                  Workspace Dashboard
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-text-dim">
          <span>&copy; {new Date().getFullYear()} OpenClip. Released under the MIT License.</span>
          <span>Built for creators, podcasters, and editors worldwide.</span>
        </div>
      </div>
    </footer>
  );
}
