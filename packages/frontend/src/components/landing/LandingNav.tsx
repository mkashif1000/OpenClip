import { ArrowRight, Github, LayoutDashboard } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

interface Props {
  onOpenDashboard: () => void;
}

export function LandingNav({ onOpenDashboard }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-3.5 backdrop-blur-xl bg-[#08080a]/80 border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <button type="button" className="shrink-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" onClick={onOpenDashboard} aria-label="OpenClip workspace">
          <BrandLogo />
        </button>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-text-muted">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#autopilot" className="hover:text-white transition-colors">
            How It Works
          </a>
          <a href="#editor" className="hover:text-white transition-colors">
            Editor
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            FAQ
          </a>
        </nav>

        {/* Right CTA cluster */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/mkashif1000/OpenClip"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-text-muted hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>

          <button
            onClick={onOpenDashboard}
            className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs sm:text-sm hover:bg-accent-hover transition-all shadow-glow hover:shadow-pop hover:scale-[1.02] active:scale-[0.98]"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>My Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
