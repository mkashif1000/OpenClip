import { useState, useRef } from 'react';
import { Sparkles, ArrowRight, Play, Upload } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useClipStore } from '@/stores/clipStore';

interface Props {
  onOpenDashboard: () => void;
}

export function LandingHero({ onOpenDashboard }: Props) {
  const { createProject, setFile } = useProjectStore();
  const setClips = useClipStore((s) => s.setClips);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleDropFile = async (file: File) => {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mkv|mov|avi|webm)$/i)) {
      alert('Please upload a video file (MP4, MKV, MOV, or WEBM).');
      return;
    }

    try {
      setIsUploading(true);
      const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 32);
      await createProject(cleanName || 'My Video Project');
      setClips([]);
      await setFile('video', file);
      onOpenDashboard();
    } catch (err) {
      console.error('Direct video upload failed:', err);
      alert('Failed to store video locally. Please check disk space.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden text-center">
      {/* Background Glow Blooms */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[450px] blur-[140px] opacity-25 -z-10"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 50%, transparent 80%)',
        }}
      />

      <div className="max-w-5xl mx-auto flex flex-col items-center">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/12 text-xs font-medium text-text-muted mb-6 shadow-soft animate-rise">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span className="font-semibold text-text uppercase tracking-wider text-[10px]">
            The 100% In-Browser AI Video Clipper
          </span>
        </div>

        {/* Main Hero Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-text leading-[1.08] mb-6 animate-rise">
          1 long video, 10 viral clips. <br />
          <span className="bg-gradient-to-r from-white via-white/90 to-white/50 bg-clip-text text-transparent">
            Create 10x faster.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-text-muted max-w-2xl leading-relaxed mb-10 animate-rise" style={{ animationDelay: '100ms' }}>
          Turn podcasts, interviews, and long videos into viral TikToks, Reels, and Shorts with AI captions and speaker tracking — completely free and 100% private in your browser.
        </p>

        {/* Quick Ingestion & Dashboard CTA Action Bar */}
        <div className="w-full max-w-xl mb-14 animate-rise" style={{ animationDelay: '180ms' }}>
          <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl glass-strong border border-white/15 shadow-pop">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mkv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleDropFile(file);
              }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto flex-1 flex items-center justify-center sm:justify-start gap-2.5 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/8 text-xs text-text-muted hover:text-white transition-colors cursor-pointer text-left truncate"
            >
              <Upload className="w-4 h-4 text-text-muted shrink-0" />
              <span className="truncate">
                {isUploading ? 'Importing video locally...' : 'Drop video file here or browse...'}
              </span>
            </button>

            <button
              onClick={onOpenDashboard}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-accent-hover transition-all shadow-glow hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <span>My Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-text-dim mt-2.5 font-mono">
            No registration needed • Media never leaves your device • Unlimited free exports
          </p>
        </div>

        {/* ─── Hero Visual Showcase Graphic (Inspired by Reference Image) ──────── */}
        <div className="w-full relative mt-4 pt-6 pb-8 animate-rise" style={{ animationDelay: '260ms' }}>
          {/* Master Video Source Card (Top) */}
          <div className="relative mx-auto max-w-md rounded-2xl glass-strong border border-white/20 p-3 shadow-pop">
            <div className="aspect-[16/9] rounded-xl bg-[#0d0d12] border border-white/10 flex flex-col justify-between p-4 relative overflow-hidden group">
              {/* Fake video visual gradient */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.03] to-white/[0.08]" />
              
              <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-black/70 text-text-muted border border-white/10">
                  SOURCE VIDEO • 42:18
                </span>
                <span className="text-[10px] text-text-dim font-mono">1080p 60fps</span>
              </div>

              {/* Centered Play Button */}
              <div className="mx-auto w-12 h-12 rounded-full glass-strong flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
              </div>

              <div className="flex items-center justify-between relative z-10 text-xs text-text font-medium">
                <span>The Deep Tech Podcast #14</span>
                <span className="text-success text-[11px] font-mono">10 Clips Extracted</span>
              </div>
            </div>

            {/* Downward Tree Branching Line */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[2px] h-10 bg-gradient-to-b from-white/40 via-white/20 to-transparent" />
          </div>

          {/* Fanning out Branching Container */}
          <div className="w-full flex items-center justify-center my-6">
            <div className="w-full max-w-2xl h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          {/* 4 Vertical Viral Shorts Cards (Bottom fanned-out result) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
            {/* Clip 1 */}
            <div className="group rounded-2xl glass-subtle border border-white/10 hover:border-white/25 p-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop flex flex-col justify-between">
              <div className="aspect-[9/16] rounded-xl bg-black relative overflow-hidden flex flex-col justify-between p-3 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-success/20 text-success border border-success/30">
                    SCORE 98
                  </span>
                  <span className="text-[9px] text-text-dim font-mono">32s</span>
                </div>

                {/* Subtitle simulation */}
                <div className="text-center my-auto">
                  <span className="text-xs sm:text-sm font-extrabold text-white leading-tight uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    &quot;THE <span className="text-[#FFE100]">SECRET</span> FORMULA&quot;
                  </span>
                </div>

                <div className="text-[10px] text-text-muted truncate font-medium">
                  High Hook Viral
                </div>
              </div>
            </div>

            {/* Clip 2 */}
            <div className="group rounded-2xl glass-subtle border border-white/10 hover:border-white/25 p-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop flex flex-col justify-between">
              <div className="aspect-[9/16] rounded-xl bg-black relative overflow-hidden flex flex-col justify-between p-3 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-success/20 text-success border border-success/30">
                    SCORE 95
                  </span>
                  <span className="text-[9px] text-text-dim font-mono">45s</span>
                </div>

                {/* Hormozi subtitle simulation */}
                <div className="text-center my-auto">
                  <span className="text-xs sm:text-sm font-black text-[#86FF4D] leading-tight uppercase drop-shadow-[0_0_8px_rgba(134,255,77,0.5)]">
                    HORMOZI POP
                  </span>
                </div>

                <div className="text-[10px] text-text-muted truncate font-medium">
                  Story Climax
                </div>
              </div>
            </div>

            {/* Clip 3 */}
            <div className="group rounded-2xl glass-subtle border border-white/10 hover:border-white/25 p-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop flex flex-col justify-between">
              <div className="aspect-[9/16] rounded-xl bg-black relative overflow-hidden flex flex-col justify-between p-3 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-white/15 text-white border border-white/20">
                    SCORE 92
                  </span>
                  <span className="text-[9px] text-text-dim font-mono">28s</span>
                </div>

                {/* Split simulation */}
                <div className="flex flex-col gap-1 w-full my-auto">
                  <div className="h-9 rounded bg-white/10 border border-white/10 flex items-center justify-center text-[9px] text-text-muted font-mono">
                    SPEAKER A
                  </div>
                  <div className="h-9 rounded bg-white/5 border border-white/8 flex items-center justify-center text-[9px] text-text-dim font-mono">
                    SPEAKER B
                  </div>
                </div>

                <div className="text-[10px] text-text-muted truncate font-medium">
                  Two-Speaker Split
                </div>
              </div>
            </div>

            {/* Clip 4 */}
            <div className="group rounded-2xl glass-subtle border border-white/10 hover:border-white/25 p-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop flex flex-col justify-between">
              <div className="aspect-[9/16] rounded-xl bg-black relative overflow-hidden flex flex-col justify-between p-3 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-white/15 text-white border border-white/20">
                    SCORE 89
                  </span>
                  <span className="text-[9px] text-text-dim font-mono">51s</span>
                </div>

                {/* Boxed simulation */}
                <div className="my-auto w-full flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-white text-center">BOXED TITLE</span>
                  <div className="w-16 h-10 rounded-lg bg-white/10 border border-white/15" />
                </div>

                <div className="text-[10px] text-text-muted truncate font-medium">
                  Boxed Layout
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
